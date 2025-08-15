export const DEMO_PAYMENTS = [
  { id: "1", date: "2025-07-01", type: "Tip", amount: 24.5, status: "completed" as const },
  { id: "2", date: "2025-07-03", type: "Payout", amount: 120.0, status: "pending" as const },
  { id: "3", date: "2025-07-08", type: "Subscription", amount: 9.99, status: "failed" as const },
];

export const DEMO_WALLET_TX = [
  { id: "w1", date: "2025-07-05", type: "Deposit", amount: 200.0, status: "completed" as const },
  { id: "w2", date: "2025-07-06", type: "Withdraw", amount: 75.25, status: "pending" as const },
  { id: "w3", date: "2025-07-10", type: "Deposit", amount: 50.0, status: "failed" as const },
];

export const DEMO_REFERRALS = [
  { id: "r1", name: "Alice Johnson", username: "alicej", joined: "2025-06-02", earnings: 24.5, avatar: "", status: "signed_up" as const },
  { id: "r2", name: "Bob Lee", username: "blee", joined: "2025-06-12", earnings: 9.99, avatar: "", status: "converted" as const },
  { id: "r3", name: "Carla Mendes", username: "carlam", joined: "2025-07-01", earnings: 0, avatar: "", status: "clicked" as const },
];

export const DEMO_SUBSCRIPTIONS = [
  { id: "s1", plan: "Basic", started: "2025-06-01", renews: "2025-09-01", price: 5.0, status: "active" as const },
  { id: "s2", plan: "Pro", started: "2025-04-15", renews: "2025-08-15", price: 12.0, status: "active" as const },
  { id: "s3", plan: "Basic", started: "2025-03-10", renews: "2025-07-10", price: 5.0, status: "canceled" as const },
];
