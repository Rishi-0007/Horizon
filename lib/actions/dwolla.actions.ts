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
      throw new Error(
        "Dwolla environment should either be set to `sandbox` or `production`"
      );
  }
};

const dwollaClient = new Client({
  environment: getEnvironment(),
  key: process.env.DWOLLA_KEY as string,
  secret: process.env.DWOLLA_SECRET as string,
});

// Create a Dwolla Funding Source using a Plaid Processor Token
export const createFundingSource = async (
  options: CreateFundingSourceOptions
) => {
  try {
    return await dwollaClient
      .post(`customers/${options.customerId}/funding-sources`, {
        name: options.fundingSourceName,
        plaidToken: options.plaidToken,
      })
      .then((res) => res.headers.get("location"));
  } catch (err) {
    console.error("Creating a Funding Source Failed: ", err);
  }
};

export const createOnDemandAuthorization = async () => {
  try {
    const onDemandAuthorization = await dwollaClient.post(
      "on-demand-authorizations"
    );
    const authLink = onDemandAuthorization.body._links;
    return authLink;
  } catch (err) {
    console.error("Creating an On Demand Authorization Failed: ", err);
  }
};

export const createDwollaCustomer = async (
  newCustomer: NewDwollaCustomerParams
) => {
  try {
    // Format dateOfBirth to YYYY-MM-DD
    const formattedDateOfBirth = formatDateForDwolla(newCustomer.dateOfBirth);

    // Validate and format postal code
    const formattedPostalCode = formatPostalCodeForDwolla(
      newCustomer.postalCode
    );

    const dwollaCustomerData = {
      ...newCustomer,
      dateOfBirth: formattedDateOfBirth,
      postalCode: formattedPostalCode,
    };

    console.log("Creating Dwolla customer with:", dwollaCustomerData);

    const response = await dwollaClient.post("customers", dwollaCustomerData);
    return response.headers.get("location");
  } catch (err) {
    console.error(
      "Creating a Dwolla Customer Failed: ",
      JSON.stringify(err, null, 2)
    );
    const errorMessage =
      typeof err === "object" && err !== null
        ? (err as any).body?.message || (err as any).message
        : String(err);
    throw new Error(`Dwolla customer creation failed: ${errorMessage}`);
  }
};

// Helper functions
function formatDateForDwolla(dateString: string): string {
  // Ensure date is in YYYY-MM-DD format
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}`);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatPostalCodeForDwolla(postalCode: string): string {
  // Remove any non-digit characters and ensure proper length
  const cleaned = postalCode.replace(/\D/g, "");

  // Basic validation for US ZIP codes (5 digits or 5-4 format)
  if (
    !/^\d{5}(-\d{4})?$/.test(cleaned) &&
    cleaned.length !== 5 &&
    cleaned.length !== 9
  ) {
    throw new Error(`Invalid US postal code format: ${postalCode}`);
  }

  return cleaned.length > 5
    ? `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`
    : cleaned;
}

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
    return await dwollaClient
      .post("transfers", requestBody)
      .then((res) => res.headers.get("location"));
  } catch (err) {
    console.error("Transfer fund failed: ", err);
  }
};

export const addFundingSource = async ({
  dwollaCustomerId,
  processorToken,
  bankName,
}: AddFundingSourceParams) => {
  try {
    // First check if funding source already exists
    const existingSources = await dwollaClient
      .get(`customers/${dwollaCustomerId}/funding-sources`)
      .then((res) => res.body._embedded["funding-sources"]);

    const existingSource = existingSources.find(
      (source: any) => source.name === bankName
    );

    if (existingSource) {
      console.log("Funding source already exists, returning existing URL");
      return existingSource._links.self.href;
    }

    // Create new funding source if it doesn't exist
    const fundingSource = await dwollaClient
      .post(`funding-sources`, {
        processorToken,
        name: bankName,
      })
      .then((res) => res.headers.get("location"));

    if (!fundingSource) {
      throw new Error("Failed to create funding source");
    }

    // Attach to customer
    await dwollaClient.post(`customers/${dwollaCustomerId}/funding-sources`, {
      _links: {
        "funding-source": {
          href: fundingSource,
        },
      },
    });

    return fundingSource;
  } catch (error) {
    console.error("Error in addFundingSource:", {
      message: (error as any)?.message,
      response: (error as any)?.response?.data,
    });
    throw error;
  }
};
