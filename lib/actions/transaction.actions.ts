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

    const senderTransactions = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal("senderBankId", bankId)]
    );

    const receiverTransactions = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal("receiverBankId", bankId)]
    );

    const transactions = [
      ...senderTransactions.documents,
      ...receiverTransactions.documents,
    ];

    return parseStringify(transactions);
  } catch (error) {
    console.error("Error getting transactions:", error);
    return parseStringify({ total: 0, documents: [] });
  }
};

export const getAllUserTransactions = async ({
  userId,
}: {
  userId: string;
}) => {
  try {
    const { database } = await createAdminClient();

    const senderTransactions = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal("senderId", userId)]
    );

    const receiverTransactions = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal("receiverId", userId)]
    );

    const all = [
      ...senderTransactions.documents,
      ...receiverTransactions.documents,
    ];

    return parseStringify(
      all.sort(
        (a, b) =>
          new Date((a as { date?: string }).date ?? 0).getTime() -
          new Date((b as { date?: string }).date ?? 0).getTime()
      )
    );
  } catch (error) {
    console.error("Error in getAllUserTransactions:", error);
    return [];
  }
};
