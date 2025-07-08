export const sidebarLinks = [
  {
    imgURL: "/icons/home.svg",
    route: "/",
    label: "Home",
  },
  {
    imgURL: "/icons/dollar-circle.svg",
    route: "/my-banks",
    label: "My Banks",
  },
  {
    imgURL: "/icons/transaction.svg",
    route: "/transaction-history",
    label: "Transaction History",
  },
  {
    imgURL: "/icons/money-send.svg",
    route: "/payment-transfer",
    label: "Transfer Funds",
  },
];

// good_user / good_password - Bank of America
export const TEST_USER_ID = "6627ed3d00267aa6fa3e";

// custom_user -> Chase Bank
// export const TEST_ACCESS_TOKEN =
//   "access-sandbox-da44dac8-7d31-4f66-ab36-2238d63a3017";

// custom_user -> Chase Bank
export const TEST_ACCESS_TOKEN =
  "access-sandbox-229476cf-25bc-46d2-9ed5-fba9df7a5d63";

export const ITEMS = [
  {
    id: "6624c02e00367128945e", // appwrite item Id
    accessToken: "access-sandbox-83fd9200-0165-4ef8-afde-65744b9d1548",
    itemId: "VPMQJKG5vASvpX8B6JK3HmXkZlAyplhW3r9xm",
    userId: "6627ed3d00267aa6fa3e",
    accountId: "X7LMJkE5vnskJBxwPeXaUWDBxAyZXwi9DNEWJ",
  },
  {
    id: "6627f07b00348f242ea9", // appwrite item Id
    accessToken: "access-sandbox-74d49e15-fc3b-4d10-a5e7-be4ddae05b30",
    itemId: "Wv7P6vNXRXiMkoKWPzeZS9Zm5JGWdXulLRNBq",
    userId: "6627ed3d00267aa6fa3e",
    accountId: "x1GQb1lDrDHWX4BwkqQbI4qpQP1lL6tJ3VVo9",
  },
];

export const topCategoryStyles = {
  "Food and Drink": {
    bg: "bg-pink-25",
    circleBg: "bg-orange-100",
    text: {
      main: "text-orange-900",
      count: "text-orange-700",
    },
    progress: {
      bg: "bg-orange-100",
      indicator: "bg-orange-700",
    },
    icon: "/icons/food.svg",
  },
  Travel: {
    bg: "bg-blue-25",
    circleBg: "bg-blue-100",
    text: {
      main: "text-blue-900",
      count: "text-blue-700",
    },
    progress: {
      bg: "bg-blue-100",
      indicator: "bg-blue-700",
    },
    icon: "/icons/car.svg",
  },
  Payment: {
    bg: "bg-green-25",
    circleBg: "bg-green-100",
    text: {
      main: "text-green-900",
      count: "text-green-700",
    },
    progress: {
      bg: "bg-green-100",
      indicator: "bg-green-700",
    },
    icon: "/icons/dollar-circle.svg",
  },
  "Bank Fees": {
    bg: "bg-yellow-25",
    circleBg: "bg-yellow-100",
    text: {
      main: "text-yellow-900",
      count: "text-yellow-700",
    },
    progress: {
      bg: "bg-yellow-100",
      indicator: "bg-yellow-700",
    },
    icon: "/icons/receipt.svg",
  },
  Transfer: {
    bg: "bg-red-25",
    circleBg: "bg-red-100",
    text: {
      main: "text-red-900",
      count: "text-red-700",
    },
    progress: {
      bg: "bg-red-100",
      indicator: "bg-red-700",
    },
    icon: "/icons/arrow-right.svg",
  },
  Success: {
    bg: "bg-emerald-25",
    circleBg: "bg-emerald-100",
    text: {
      main: "text-emerald-900",
      count: "text-emerald-700",
    },
    progress: {
      bg: "bg-emerald-100",
      indicator: "bg-emerald-700",
    },
    icon: "/icons/coins.svg",
  },
  Shopping: {
    bg: "bg-pink-25",
    circleBg: "bg-pink-100",
    text: {
      main: "text-pink-900",
      count: "text-pink-700",
    },
    progress: {
      bg: "bg-pink-100",
      indicator: "bg-pink-700",
    },
    icon: "/icons/shopping-bag.svg",
  },
  default: {
    bg: "bg-gray-25",
    circleBg: "bg-gray-100",
    text: {
      main: "text-gray-900",
      count: "text-gray-700",
    },
    progress: {
      bg: "bg-gray-100",
      indicator: "bg-gray-700",
    },
    icon: "/icons/tag.svg",
  },
};

export const transactionCategoryStyles = {
  "Food and Drink": {
    borderColor: "border-orange-600",
    backgroundColor: "bg-orange-500/10",
    textColor: "text-orange-700",
    chipBackgroundColor: "bg-orange-50",
  },
  Travel: {
    borderColor: "border-blue-600",
    backgroundColor: "bg-blue-500/10",
    textColor: "text-blue-700",
    chipBackgroundColor: "bg-blue-50",
  },
  Payment: {
    borderColor: "border-green-600",
    backgroundColor: "bg-green-500/10",
    textColor: "text-green-700",
    chipBackgroundColor: "bg-green-50",
  },
  "Bank Fees": {
    borderColor: "border-yellow-600",
    backgroundColor: "bg-yellow-500/10",
    textColor: "text-yellow-700",
    chipBackgroundColor: "bg-yellow-50",
  },
  Transfer: {
    borderColor: "border-red-600",
    backgroundColor: "bg-red-500/10",
    textColor: "text-red-700",
    chipBackgroundColor: "bg-red-50",
  },
  Success: {
    borderColor: "border-emerald-600",
    backgroundColor: "bg-emerald-500/10",
    textColor: "text-emerald-700",
    chipBackgroundColor: "bg-emerald-50",
  },
  Shopping: {
    borderColor: "border-pink-600",
    backgroundColor: "bg-pink-500/10",
    textColor: "text-pink-700",
    chipBackgroundColor: "bg-pink-50",
  },
  default: {
    borderColor: "border-gray-600",
    backgroundColor: "bg-gray-500/10",
    textColor: "text-gray-700",
    chipBackgroundColor: "bg-gray-50",
  },
};
