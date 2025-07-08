"use server";

import { Client } from "dwolla-v2";

const getEnvironment = (): "production" | "sandbox" => {
  const environment = process.env.DWOLLA_ENV as string;
  switch (environment) {
    case "sandbox":
      return "sandbox";
    case "production":
      return "production";
    default:
      throw new Error("Dwolla environment must be 'sandbox' or 'production'");
  }
};

const dwollaClient = new Client({
  environment: getEnvironment(),
  key: process.env.DWOLLA_KEY as string,
  secret: process.env.DWOLLA_SECRET as string,
});

// Enhanced funding source creation with proper error handling
export const createFundingSource = async (
  options: CreateFundingSourceOptions
) => {
  try {
    const requestBody = {
      name: options.fundingSourceName,
      plaidToken: options.plaidToken,
    };

    console.log("Creating funding source with:", {
      customerId: options.customerId,
      body: requestBody,
    });

    const response = await dwollaClient.post(
      `customers/${options.customerId}/funding-sources`,
      requestBody
    );

    if (!response.headers.get("location")) {
      throw new Error("No location header in response");
    }

    return response.headers.get("location");
  } catch (err) {
    console.error("Detailed funding source creation error:", {
      message: (err as any)?.message,
      response: (err as any)?.response?.body,
      customerId: options.customerId,
    });
    throw new Error(
      (err as any)?.response?.body?.message || "Failed to create funding source"
    );
  }
};

// Enhanced addFundingSource with proper request body
export const addFundingSource = async ({
  dwollaCustomerId,
  processorToken,
  bankName,
}: AddFundingSourceParams) => {
  try {
    // First check if funding source exists
    const existingSources = await dwollaClient
      .get(`customers/${dwollaCustomerId}/funding-sources`)
      .then((res) => res.body._embedded?.["funding-sources"] || []);

    const existingSource = existingSources.find(
      (source: any) => source.name === bankName
    );

    if (existingSource) {
      console.log(
        "Using existing funding source:",
        existingSource._links.self.href
      );
      return existingSource._links.self.href;
    }

    // Create new funding source with proper body structure
    const fundingSourceResponse = await dwollaClient.post(`funding-sources`, {
      processorToken: processorToken,
      name: bankName,
    });

    const fundingSourceUrl = fundingSourceResponse.headers.get("location");
    if (!fundingSourceUrl) {
      throw new Error("No location header in funding source response");
    }

    // Attach to customer with proper body structure
    await dwollaClient.post(`customers/${dwollaCustomerId}/funding-sources`, {
      _links: {
        "funding-source": {
          href: fundingSourceUrl,
        },
      },
    });

    return fundingSourceUrl;
  } catch (error) {
    console.error("Detailed addFundingSource error:", {
      message: (error as any)?.message,
      response: (error as any)?.response?.body,
      customerId: dwollaCustomerId,
      bankName,
    });
    throw new Error(
      (error as any)?.response?.body?.message || "Failed to add funding source"
    );
  }
};

// Enhanced customer creation with proper validation
export const createDwollaCustomer = async (
  newCustomer: NewDwollaCustomerParams
) => {
  try {
    const requestBody = {
      firstName: newCustomer.firstName,
      lastName: newCustomer.lastName,
      email: newCustomer.email,
      address1: newCustomer.address1,
      city: newCustomer.city,
      state: newCustomer.state,
      postalCode: formatPostalCodeForDwolla(newCustomer.postalCode),
      dateOfBirth: formatDateForDwolla(newCustomer.dateOfBirth),
      ssn: newCustomer.ssn,
    };

    console.log("Creating Dwolla customer with:", requestBody);

    const response = await dwollaClient.post("customers", requestBody);
    const location = response.headers.get("location");

    if (!location) {
      throw new Error("No location header in response");
    }

    return location;
  } catch (err) {
    console.error("Detailed Dwolla customer creation error:", {
      message: (err as any)?.message,
      response: (err as any)?.response?.body,
      customerData: newCustomer,
    });
    throw new Error(
      (err as any)?.response?.body?.message ||
        "Failed to create Dwolla customer"
    );
  }
};

// Enhanced transfer creation
export const createTransfer = async ({
  sourceFundingSourceUrl,
  destinationFundingSourceUrl,
  amount,
}: TransferParams) => {
  try {
    const requestBody = {
      _links: {
        source: {
          href: sourceFundingSourceUrl,
        },
        destination: {
          href: destinationFundingSourceUrl,
        },
      },
      amount: {
        currency: "USD",
        value: amount,
      },
    };

    console.log("Creating transfer with:", requestBody);

    const response = await dwollaClient.post("transfers", requestBody);
    const location = response.headers.get("location");

    if (!location) {
      throw new Error("No location header in transfer response");
    }

    return location;
  } catch (err) {
    console.error("Detailed transfer creation error:", {
      message: (err as any)?.message,
      response: (err as any)?.response?.body,
      source: sourceFundingSourceUrl,
      destination: destinationFundingSourceUrl,
      amount,
    });
    throw new Error(
      (err as any)?.response?.body?.message || "Failed to create transfer"
    );
  }
};

// Helper functions remain the same
function formatDateForDwolla(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}`);
  }
  return date.toISOString().split("T")[0];
}

function formatPostalCodeForDwolla(postalCode: string): string {
  const cleaned = postalCode.replace(/\D/g, "");
  if (cleaned.length !== 5 && cleaned.length !== 9) {
    throw new Error(`Invalid US postal code format: ${postalCode}`);
  }
  return cleaned.length > 5
    ? `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`
    : cleaned;
}
