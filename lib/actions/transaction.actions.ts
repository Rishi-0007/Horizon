"use server";

import { ID, Query } from "node-appwrite";
import { createAdminClient } from "../appwrite";
import { generateTransactionFingerprint, parseStringify } from "../utils";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_TRANSACTION_COLLECTION_ID: TRANSACTION_COLLECTION_ID,
} = process.env;

export const createTransaction = async (
  transaction: CreateTransactionProps
) => {
  try {
    const { database } = await createAdminClient();
    const extractId = (entity: any) =>
      typeof entity === "string" ? entity : entity?.$id;

    const senderId = extractId(transaction.senderId);
    const receiverId = extractId(transaction.receiverId);
    const userId = extractId(transaction.userId);

    if (!userId) {
      throw new Error("userId is required");
    }

    // ✅ Step 1: Generate fingerprint
    const fingerprint =
      transaction.fingerprint ||
      generateTransactionFingerprint({
        amount: transaction.amount,
        date: transaction.date || new Date().toISOString(),
        merchant: transaction.merchant || "",
        userId,
        senderBankId: transaction.senderBankId,
      });

    // ✅ Step 2: Check for existing transaction
    const existing = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal("fingerprint", fingerprint)]
    );

    if (existing.total > 0) {
      console.log("Duplicate transaction skipped:", fingerprint);
      return null; // or return existing.documents[0]
    }

    // ✅ Step 3: Proceed to create transaction
    const newTransaction = await database.createDocument(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      ID.unique(),
      {
        name: transaction.name,
        amount: Number(transaction.amount),
        senderId,
        senderBankId: transaction.senderBankId,
        receiverId,
        receiverBankId: transaction.receiverBankId,
        userId,
        type: transaction.type,
        category: transaction.category,
        channel: transaction.channel,
        date: transaction.date || new Date().toISOString(),
        merchant: transaction.merchant,
        logoUrl: transaction.logoUrl,
        plaidTransactionId: transaction.plaidTransactionId,
        fingerprint,
        $permissions: [`read("user:${userId}")`, `write("user:${userId}")`],
      }
    );

    return parseStringify(newTransaction);
  } catch (error) {
    console.error("Error creating transaction:", {
      message: error instanceof Error ? error.message : String(error),
      transaction,
    });
    throw error;
  }
};

export const getTransactionsByBankId = async ({
  bankId,
}: getTransactionsByBankIdProps) => {
  try {
    const { database } = await createAdminClient();

    // ✅ Only fetch DEBIT transactions where bank was the sender
    const senderTransactionsRes = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal("senderBankId", bankId), Query.equal("type", "debit")]
    );

    // ✅ Only fetch CREDIT transactions where bank was the receiver
    const receiverTransactionsRes = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal("receiverBankId", bankId), Query.equal("type", "credit")]
    );

    // ✅ Merge and deduplicate
    const uniqueMap = new Map();
    [
      ...senderTransactionsRes.documents,
      ...receiverTransactionsRes.documents,
    ].forEach((txn) => {
      uniqueMap.set(txn.$id, txn);
    });

    const transactions = Array.from(uniqueMap.values()).sort(
      (a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return parseStringify(transactions);
  } catch (error) {
    console.error("Error getting transactions by bankId:", error);
    return parseStringify({ total: 0, documents: [] });
  }
};

export const getTransactionsByUserId = async (userId: string) => {
  try {
    const { database } = await createAdminClient();

    const response = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal("userId", userId), Query.orderDesc("date"), Query.limit(100)]
    );

    return parseStringify(response.documents);
  } catch (error) {
    console.error("Error fetching transactions by userId:", error);
    return [];
  }
};
