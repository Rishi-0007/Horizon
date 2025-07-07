"use server";

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { cookies } from "next/headers";
import { encryptId, extractCustomerIdFromUrl, parseStringify } from "../utils";
import {
  CountryCode,
  ProcessorTokenCreateRequest,
  ProcessorTokenCreateRequestProcessorEnum,
  Products,
} from "plaid";

import { plaidClient } from "@/lib/plaid";
import { revalidatePath } from "next/cache";
import { addFundingSource, createDwollaCustomer } from "./dwolla.actions";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

export const getUserInfo = async ({ userId }: getUserInfoProps) => {
  try {
    const { database } = await createAdminClient();

    console.log(
      `Looking for user with userId: ${userId} in collection: ${USER_COLLECTION_ID}`
    );

    const user = await database.listDocuments(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      [Query.equal("userId", [userId])]
    );

    console.log("User query results:", user);

    if (user.total === 0 || !user.documents[0]) {
      console.error(`User not found in database. Total matches: ${user.total}`);
      return null;
    }

    return user.documents[0];
  } catch (error) {
    console.error("Error in getUserInfo:", error);
    return null;
  }
};

export const signIn = async ({ email, password }: signInProps) => {
  try {
    const { account } = await createAdminClient();
    const session = await account.createEmailPasswordSession(email, password);

    console.log("Session created with userId:", session.userId);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    const user = await getUserInfo({ userId: session.userId });

    if (!user) {
      // Check if user exists directly by ID as fallback
      console.log("Trying fallback user lookup...");
      const { database } = await createAdminClient();
      const userDoc = await database.getDocument(
        DATABASE_ID!,
        USER_COLLECTION_ID!,
        session.userId
      );

      if (userDoc) {
        console.log("Found user via direct ID lookup");
        return parseStringify(userDoc);
      }

      throw new Error("User exists but couldn't be retrieved");
    }

    return parseStringify(user);
  } catch (error) {
    console.error("SignIn error:", error);
    return null;
  }
};

export const signUp = async ({ password, ...userData }: SignUpParams) => {
  const { email, firstName, lastName } = userData;

  try {
    // 1. Create Auth account first
    const { account, database } = await createAdminClient();
    const newUserAccount = await account.create(
      ID.unique(),
      email,
      password,
      `${firstName} ${lastName}`
    );

    if (!newUserAccount) throw new Error("Failed to create auth account");

    console.log("Auth account created with ID:", newUserAccount.$id);

    // 2. Create Dwolla customer
    const dwollaCustomerUrl = await createDwollaCustomer({
      ...userData,
      type: "personal",
    });

    if (!dwollaCustomerUrl) throw new Error("Failed to create Dwolla customer");

    const dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);
    console.log("Dwolla customer created:", dwollaCustomerId);

    // 3. Create database document
    const newUser = await database.createDocument(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      newUserAccount.$id, // Using auth account ID as document ID
      {
        ...userData,
        userId: newUserAccount.$id,
        dwollaCustomerId,
        dwollaCustomerUrl,
        email, // Ensure email is included
      }
    );

    console.log("Database document created:", newUser);

    // 4. Create session
    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return parseStringify(newUser);
  } catch (error) {
    if (error && typeof error === "object") {
      console.error("SignUp error details:", {
        message: (error as any).message,
        code: (error as any).code,
        type: (error as any).type,
        response: (error as any).response,
      });
    } else {
      console.error("SignUp error details:", error);
    }
    throw error; // Re-throw to handle in UI
  }
};

export async function getLoggedInUser() {
  try {
    const sessionClient = await createSessionClient();
    if (!sessionClient) return null;

    const result = await sessionClient.account.get();
    if (!result?.$id) return null;

    const user = await getUserInfo({ userId: result.$id });
    return parseStringify(user);
  } catch (error) {
    console.error("Error getting logged in user:", error);
    return null;
  }
}

export const logoutAccount = async () => {
  try {
    const sessionClient = await createSessionClient();
    if (!sessionClient) return null;
    const { account } = sessionClient;

    cookies().delete("appwrite-session");

    await account.deleteSession("current");
  } catch (error) {
    return null;
  }
};

export const createLinkToken = async (user: User) => {
  try {
    const tokenParams = {
      user: {
        client_user_id: user.$id,
      },
      client_name: `${user.firstName} ${user.lastName}`,
      products: [
        "assets",
        "auth",
        "balance",
        "identity",
        "identity_match",
        "investments",
        "investments_auth",
        "liabilities",
        "payment_initiation",
        "identity_verification",
        "transactions",
        "credit_details",
        "income",
        "income_verification",
        "deposit_switch",
        "standing_orders",
        "transfer",
        "employment",
        "recurring_transactions",
        "signal",
        "statements",
        "processor_payments",
        "processor_identity",
        "profile",
      ] as Products[],
      language: "en",
      country_codes: ["US"] as CountryCode[],
    };

    const response = await plaidClient.linkTokenCreate(tokenParams);

    return parseStringify({ linkToken: response.data.link_token });
  } catch (error) {
    console.log(error);
  }
};

export const createBankAccount = async ({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  shareableId,
}: createBankAccountProps) => {
  try {
    const { database } = await createAdminClient();

    console.log("Creating bank account with:", {
      userId,
      bankId,
      accountId,
      fundingSourceUrl,
      shareableId,
    });

    const bankAccount = await database.createDocument(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      ID.unique(),
      {
        userId,
        bankId,
        accountId,
        accessToken,
        fundingSourceUrl,
        shareableId,
      }
    );

    console.log("Bank account created successfully:", bankAccount);
    return parseStringify(bankAccount);
  } catch (error) {
    console.error("Error creating bank account:", {
      message:
        typeof error === "object" && error !== null && "message" in error
          ? (error as { message?: string }).message
          : String(error),
      code:
        typeof error === "object" && error !== null && "code" in error
          ? (error as { code?: string }).code
          : undefined,
      type:
        typeof error === "object" && error !== null && "type" in error
          ? (error as { type?: string }).type
          : undefined,
    });
    return null;
  }
};

export const exchangePublicToken = async ({
  publicToken,
  user,
}: exchangePublicTokenProps) => {
  try {
    // 1. Exchange public token
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // 2. Get account info
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    const accountData = accountsResponse.data.accounts[0];

    // 3. Create processor token
    const processorTokenResponse = await plaidClient.processorTokenCreate({
      access_token: accessToken,
      account_id: accountData.account_id,
      processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
    });
    const processorToken = processorTokenResponse.data.processor_token;

    // 4. Add funding source
    const fundingSourceUrl = await addFundingSource({
      dwollaCustomerId: user.dwollaCustomerId,
      processorToken,
      bankName: accountData.name,
    });

    if (!fundingSourceUrl) {
      throw new Error("Failed to create funding source");
    }

    // 5. Create bank account record
    const bankAccount = await createBankAccount({
      userId: user.$id,
      bankId: itemId,
      accountId: accountData.account_id,
      accessToken,
      fundingSourceUrl,
      shareableId: accountData.account_id,
    });

    if (!bankAccount) {
      throw new Error("Failed to create bank account record");
    }

    revalidatePath("/");
    return parseStringify({ publicTokenExchange: "complete" });
  } catch (error) {
    console.error("Error in exchangePublicToken:", {
      message:
        typeof error === "object" && error !== null && "message" in error
          ? (error as { message?: string }).message
          : String(error),
      stack:
        typeof error === "object" && error !== null && "stack" in error
          ? (error as { stack?: string }).stack
          : undefined,
      response:
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        (error as any).response?.data
          ? (error as any).response.data
          : undefined,
    });
    throw error;
  }
};

export const getBanks = async ({ userId }: getBanksProps) => {
  try {
    const { database } = await createAdminClient();

    const banks = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal("userId", [userId])]
    );

    return parseStringify(banks.documents);
  } catch (error) {
    console.log(error);
  }
};

export const getBank = async ({ documentId }: getBankProps) => {
  try {
    const { database } = await createAdminClient();

    const bank = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal("$id", [documentId])]
    );

    return parseStringify(bank.documents[0]);
  } catch (error) {
    console.log(error);
  }
};

export const getBankByAccountId = async ({
  accountId,
}: getBankByAccountIdProps) => {
  try {
    const { database } = await createAdminClient();

    const bank = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal("accountId", [accountId])]
    );

    if (bank.total !== 1) return null;
    return parseStringify(bank.documents[0]);
  } catch (error) {
    console.error("Error getting bank by account ID:", {
      accountId,
      error:
        typeof error === "object" && error !== null && "message" in error
          ? (error as { message?: string }).message
          : String(error),
    });
    return null;
  }
};
