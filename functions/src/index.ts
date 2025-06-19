import * as functions from "firebase-functions";
import { defineString } from "firebase-functions/params";
import Stripe from "stripe";

// Define Stripe secret key and CORS configuration
const stripeSecretKey = defineString("STRIPE_SECRET_KEY");

export const createCheckoutSessionCallable = functions.https.onCall(
  { secrets: [stripeSecretKey] },
  async (request, context) => {
    // 1. Log the entire request.data object
    console.log("Received request.data:", JSON.stringify(request.data));

    if (!context.auth) {
      console.error("Authentication Error: The function must be called while authenticated.");
      throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = context.auth.uid;
    console.log("Authenticated userId:", userId);

    // Destructure parameters from request.data
    const { priceId, successUrl, cancelUrl } = request.data;

    // 2. Log individual values
    console.log("priceId:", priceId);
    console.log("successUrl:", successUrl);
    console.log("cancelUrl:", cancelUrl);

    // 3. Implement validation block
    if (!priceId || typeof priceId !== 'string' || priceId.trim() === "") {
      console.error("Validation Error: priceId is missing or invalid.", { priceId });
      throw new functions.https.HttpsError("invalid-argument", "The 'priceId' parameter is required and must be a non-empty string.");
    }
    if (!successUrl || typeof successUrl !== 'string' || successUrl.trim() === "") {
      console.error("Validation Error: successUrl is missing or invalid.", { successUrl });
      throw new functions.https.HttpsError("invalid-argument", "The 'successUrl' parameter is required and must be a non-empty string.");
    }
    if (!cancelUrl || typeof cancelUrl !== 'string' || cancelUrl.trim() === "") {
      console.error("Validation Error: cancelUrl is missing or invalid.", { cancelUrl });
      throw new functions.https.HttpsError("invalid-argument", "The 'cancelUrl' parameter is required and must be a non-empty string.");
    }
    // Basic URL validation
    try {
      new URL(successUrl);
      new URL(cancelUrl);
    } catch (urlError) {
      console.error("Validation Error: successUrl or cancelUrl is not a valid URL.", { successUrl, cancelUrl, urlError });
      throw new functions.https.HttpsError("invalid-argument", "The 'successUrl' and 'cancelUrl' parameters must be valid URLs.");
    }

    // Initialize Stripe SDK
    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2023-10-16", // Use the latest API version
    });

    try {
      // Create a Stripe Checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription", // or "subscription" based on your needs
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: userId,
      });

      // Return the session ID to the client
      return { sessionId: session.id };
    } catch (error) {
      // 4. Enhanced error logging
      console.error("Stripe Checkout Session Error:", error);
      if (error instanceof Error) { // Check if error is an instance of Error
          console.error("Error message:", error.message);
          // If Stripe-specific error structure is known and error is of that type
          const stripeError = error as any; // Use 'as any' or a specific StripeError type if available
          if (stripeError.type) {
              console.error("Stripe error type:", stripeError.type);
          }
          if (stripeError.code) {
              console.error("Stripe error code:", stripeError.code);
          }
          if (stripeError.param) {
              console.error("Stripe error param:", stripeError.param);
          }
          if (stripeError.doc_url) {
              console.error("Stripe error doc_url:", stripeError.doc_url);
          }
      }
      // Ensure the original throw is preserved
      throw new functions.https.HttpsError("internal", `Unable to create checkout session. Original error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
