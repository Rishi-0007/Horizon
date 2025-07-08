"use server";

import { ID, Query } from "node-appwrite";
import { createAdminClient } from "../appwrite";
import { parseStringify } from "../utils";

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
        website: transaction.website,
        plaidTransactionId: transaction.plaidTransactionId,
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
