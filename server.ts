import express from "express";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripeClient = new Stripe(key, { apiVersion: '2024-04-10' });
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // ==========================================
  // 1. WEBHOOKS (MÅSTE VARA FÖRE EXPRESS.JSON)
  // ==========================================
  // Stripe kräver raw body för att kunna verifiera signaturer
  app.post("/api/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const stripe = getStripe();
      // TODO: Implement webhook handling (uppdatera databasen när betalning lyckas)
      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  // ==========================================
  // 2. MIDDLEWARE (FÖR ALLA ANDRA ROUTES)
  // ==========================================
  app.use(express.json());

  // ==========================================
  // 3. API ROUTES
  // ==========================================
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Skapa en Checkout Session när nån klickar på "Köp Medlemskap"
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const stripe = getStripe();
      const { userId, organizationId } = req.body;

      // Kolla så vi har ett ID på användaren
      if (!userId) {
        return res.status(400).json({ error: "userId saknas i anropet" });
      }

      // Hämta pris-ID från .env (detta skapar du i din Stripe Dashboard)
      const priceId = process.env.STRIPE_PRICE_ID;
      if (!priceId) {
        throw new Error("STRIPE_PRICE_ID saknas i .env filen");
      }

      // Räkna ut var användaren kom ifrån så vi kan skicka tillbaka dem
      const domain = req.headers.origin || `http://localhost:${PORT}`;

      // Skapa själva sessionen hos Stripe
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription', // Ändra till 'payment' om det är en engångssumma
        line_items: [
          {
            price: priceId, // ID:t för din prenumeration i Stripe (t.ex. price_1N...)
            quantity: 1,
          },
        ],
        // Vart användaren skickas efter betalning/avbruten betalning
        success_url: `${domain}/?success=true`,
        cancel_url: `${domain}/?canceled=true`,
        
        // --- SUPERVIKTIGT ---
        // Vi sparar userId i metadata så webhooken vet VEM som just betalade
        client_reference_id: userId, 
        metadata: {
          userId: userId,
          organizationId: organizationId || 'unknown'
        }
      });

      // Skicka tillbaka URL:en till frontend (PaywallScreen)
      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout session error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // 4. VITE & FRONTEND SERVING
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();