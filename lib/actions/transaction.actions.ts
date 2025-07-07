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

    // Validate required fields
    if (!transaction.userId) {
      throw new Error("userId is required");
    }

    const newTransaction = await database.createDocument(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      ID.unique(),
      {
        name: transaction.name,
        amount: Number(transaction.amount),
        senderBankId: transaction.senderBankId,
        receiverBankId: transaction.receiverBankId,
        userId: transaction.userId,
        type: transaction.type || "debit", // default to debit
        category: transaction.category || "Transfer",
        channel: transaction.channel || "online",
        date: transaction.date || new Date().toISOString(),
        $permissions: [
          `read("user:${transaction.userId}")`,
          `write("user:${transaction.userId}")`,
        ],
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

    const transactions = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [
        Query.or([
          Query.equal("senderBankId", bankId),
          Query.equal("receiverBankId", bankId),
        ]),
        Query.orderDesc("$createdAt"),
      ]
    );

    return parseStringify(transactions);
  } catch (error) {
    console.error("Error getting transactions:", error);
    return parseStringify({ total: 0, documents: [] });
  }
};
