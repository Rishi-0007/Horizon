"use server";

import { Client, Account, Databases, Users } from "node-appwrite";
import { cookies } from "next/headers";

export async function createSessionClient() {
  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!);

    const session = cookies().get("appwrite-session");

    if (!session || !session.value) {
      return null;
    }

    client.setSession(session.value);

    return {
      get account() {
        return new Account(client);
      },
    };
  } catch (error) {
    console.error("Error creating session client:", error);
    return null;
  }
}

export async function createAdminClient() {
  try {
    console.log(
      "Creating admin client with endpoint:",
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
    );
    console.log("Project ID:", process.env.NEXT_PUBLIC_APPWRITE_PROJECT);

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
      .setKey(process.env.NEXT_APPWRITE_KEY!);

    return {
      get account() {
        return new Account(client);
      },
      get database() {
        return new Databases(client);
      },
      get user() {
        return new Users(client);
      },
    };
  } catch (error) {
    console.error("Error creating admin client:", error);
    throw error;
  }
}
