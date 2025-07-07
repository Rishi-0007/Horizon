"use server";

import {
  ACHClass,
  CountryCode,
  TransferAuthorizationCreateRequest,
  TransferCreateRequest,
  TransferNetwork,
  TransferType,
} from "plaid";

import { plaidClient } from "../plaid";
import { parseStringify } from "../utils";

import {
  createTransaction,
  getTransactionsByBankId,
} from "./transaction.actions";
import { getBanks, getBank } from "./user.actions";

// Get multiple bank accounts
export const getAccounts = async ({ userId }: getAccountsProps) => {
  try {
    // Get banks from db with error handling
    const banks = await getBanks({ userId });
    if (!banks || banks.length === 0) {
      return parseStringify({
        data: [],
        totalBanks: 0,
        totalCurrentBalance: 0,
      });
    }

    const accounts = await Promise.all(
      banks.map(async (bank: Bank) => {
        try {
          // Get account info from Plaid
          const accountsResponse = await plaidClient.accountsGet({
            access_token: bank.accessToken,
          });

          const accountData = accountsResponse.data.accounts[0];
          if (!accountData) {
            console.error("No account data found for bank:", bank.$id);
            return null;
          }

          // Get institution info
          const institution = await getInstitution({
            institutionId: accountsResponse.data.item.institution_id!,
          });

          return {
            id: accountData.account_id,
            availableBalance: accountData.balances.available || 0,
            currentBalance: accountData.balances.current || 0,
            institutionId: institution.institution_id,
            name: accountData.name,
            officialName: accountData.official_name || accountData.name,
            mask: accountData.mask || "0000",
            type: accountData.type as string,
            subtype: (accountData.subtype || "checking") as string,
            appwriteItemId: bank.$id,
            shareableId: bank.shareableId,
          };
        } catch (error) {
          console.error(`Error processing bank ${bank.$id}:`, {
            message: error.message,
            bankId: bank.$id,
          });
          return null;
        }
      })
    );

    // Filter out failed accounts
    const validAccounts = accounts.filter((account) => account !== null);
    const totalBanks = validAccounts.length;
    const totalCurrentBalance = validAccounts.reduce(
      (total, account) => total + (account?.currentBalance || 0),
      0
    );

    return parseStringify({
      data: validAccounts,
      totalBanks,
      totalCurrentBalance,
    });
  } catch (error) {
    console.error("Error in getAccounts:", {
      message: error.message,
      userId,
    });
    return parseStringify({ data: [], totalBanks: 0, totalCurrentBalance: 0 });
  }
};

// Get one bank account
export const getAccount = async ({ appwriteItemId }: getAccountProps) => {
  try {
    const bank = await getBank({ documentId: appwriteItemId });
    if (!bank) throw new Error("Bank not found");

    // 1. Get account info
    const accountsResponse = await plaidClient.accountsGet({
      access_token: bank.accessToken,
    });
    const accountData = accountsResponse.data.accounts[0];

    // 2. Get Plaid transactions
    const plaidTransactions = await getTransactions({
      accessToken: bank.accessToken,
    });

    // 3. Store Plaid transactions in Appwrite
    const storedTransactions = await Promise.all(
      plaidTransactions.map(async (t) => {
        try {
          return await createTransaction({
            name: t.name,
            amount: t.amount,
            senderBankId: t.type === "debit" ? bank.$id : undefined,
            receiverBankId: t.type === "credit" ? bank.$id : undefined,
            userId: bank.userId,
            type: t.type,
            category: t.category,
            channel: t.channel,
            date: t.date,
          });
        } catch (e: unknown) {
          console.error("Error storing transaction:", e);
          return null;
        }
      })
    );

    // 4. Get internal transfers
    const transferTransactionsData = await getTransactionsByBankId({
      bankId: bank.$id,
    });

    const transferTransactions = transferTransactionsData.documents.map(
      (t: Transaction) => ({
        id: t.$id,
        name: t.name || "Transfer",
        amount: t.amount || 0,
        date: t.date || t.$createdAt,
        paymentChannel: t.channel || "transfer",
        category: t.category || "Transfer",
        type: t.type || (t.senderBankId === bank.$id ? "debit" : "credit"),
      })
    );

    // 5. Get institution info
    const institution = await getInstitution({
      institutionId: accountsResponse.data.item.institution_id!,
    });

    const account = {
      id: accountData.account_id,
      availableBalance: accountData.balances.available!,
      currentBalance: accountData.balances.current!,
      institutionId: institution.institution_id,
      name: accountData.name,
      officialName: accountData.official_name,
      mask: accountData.mask!,
      type: accountData.type as string,
      subtype: accountData.subtype! as string,
      appwriteItemId: bank.$id,
    };

    // 6. Merge transactions (both stored and new)
    const allTransactions = [
      ...storedTransactions.filter((t) => t !== null),
      ...transferTransactions,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return parseStringify({
      data: account,
      transactions: allTransactions,
      status: "complete",
    });
  } catch (error) {
    console.error("Error in getAccount:", {
      appwriteItemId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
};

// Get bank info
export const getInstitution = async ({
  institutionId,
}: getInstitutionProps) => {
  try {
    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: ["US"] as CountryCode[],
    });

    const intitution = institutionResponse.data.institution;

    return parseStringify(intitution);
  } catch (error) {
    console.error("An error occurred while getting the accounts:", error);
  }
};

// Get transactions
export const getTransactions = async ({
  accessToken,
}: getTransactionsProps) => {
  let transactions: Transaction[] = [];
  try {
    let hasMore = true;
    let cursor = undefined;

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: cursor,
      });

      console.log("Plaid response:", {
        added: response.data.added.length,
        modified: response.data.modified.length,
        removed: response.data.removed.length,
        has_more: response.data.has_more,
      });

      transactions = [
        ...transactions,
        ...response.data.added.map((t) => ({
          id: t.transaction_id,
          name: t.name,
          amount: t.amount,
          date: t.date,
          paymentChannel: t.payment_channel,
          category: t.category?.[0] || "",
          pending: t.pending,
          type: t.payment_channel,
          accountId: t.account_id,
          image: t.logo_url ?? undefined,
          channel: t.payment_channel,
        })),
      ];

      hasMore = response.data.has_more;
      cursor = response.data.next_cursor;
    }

    console.log("Total transactions fetched:", transactions.length);
    return transactions;
  } catch (error) {
    console.error("Detailed Plaid error:", {
      message: error instanceof Error ? error.message : String(error),
      response:
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        (error as any).response?.data
          ? (error as any).response.data
          : undefined,
      status:
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        (error as any).response?.status
          ? (error as any).response.status
          : undefined,
    });
    return [];
  }
};
