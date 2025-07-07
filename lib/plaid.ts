import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": "686a194c755640002483cfd4",
      "PLAID-SECRET": "019680708743fcba3edfcc844e5ae1",
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
