import { createRequire } from "module";
import { pathToFileURL } from "url";

// import.meta.url is undefined in the esbuild CJS production bundle;
// fall back to a file URL derived from cwd so createRequire always gets
// a valid argument in both ESM (dev) and CJS (prod) contexts.
const _metaUrl: string | undefined = (import.meta as any).url;
const _req = createRequire(
  typeof _metaUrl === "string"
    ? _metaUrl
    : pathToFileURL(process.cwd() + "/package.json").href
);
const Iyzipay = _req("iyzipay");

const IYZICO_CONFIGURED = !!(process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY);

const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY || "sandbox-dummy-key",
  secretKey: process.env.IYZICO_SECRET_KEY || "sandbox-dummy-secret",
  uri: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com",
});

export { IYZICO_CONFIGURED };

export interface PaymentRequest {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: "standard" | "unlimited";
  ip: string;
}

// Monthly prices in TRY
const PLAN_PRICES: Record<string, { price: string; name: string }> = {
  standard: { price: "1490.00", name: "VesselPDA Standard Plan" },
  unlimited: { price: "5990.00", name: "VesselPDA Unlimited Plan" },
};

export function createCheckoutForm(req: PaymentRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!IYZICO_CONFIGURED) {
      return reject(new Error("Payment gateway is not configured. Please contact support."));
    }

    const plan = PLAN_PRICES[req.plan];
    if (!plan) return reject(new Error("Invalid plan"));

    const appUrl = process.env.APP_URL || "https://vesselpda.com";
    const callbackUrl = `${appUrl}/api/payment/callback`;

    const request = {
      locale: Iyzipay.LOCALE.EN,
      conversationId: `sub_${req.userId}_${Date.now()}`,
      price: plan.price,
      paidPrice: plan.price,
      currency: Iyzipay.CURRENCY.TRY,
      basketId: `basket_${req.userId}`,
      paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
      callbackUrl,
      enabledInstallments: [1],
      buyer: {
        id: req.userId,
        name: req.firstName || "User",
        surname: req.lastName || "VesselPDA",
        email: req.email,
        identityNumber: "11111111111",
        registrationAddress: "Istanbul, Turkey",
        ip: req.ip || "127.0.0.1",
        city: "Istanbul",
        country: "Turkey",
      },
      billingAddress: {
        contactName: `${req.firstName || "User"} ${req.lastName || ""}`.trim(),
        city: "Istanbul",
        country: "Turkey",
        address: "Istanbul, Turkey",
      },
      basketItems: [
        {
          id: `plan_${req.plan}`,
          name: plan.name,
          category1: "Subscription",
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: plan.price,
        },
      ],
    };

    iyzipay.checkoutFormInitialize.create(request, (err: any, result: any) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

export function retrieveCheckoutResult(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    iyzipay.checkoutForm.retrieve(
      { locale: Iyzipay.LOCALE.EN, token },
      (err: any, result: any) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
}
