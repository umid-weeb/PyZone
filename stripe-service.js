const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

// Stripe maxfiy kaliti (.env faylidan olinadi)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// 1. Checkout Session yaratish (Foydalanuvchini to'lov sahifasiga yo'naltirish)
router.post('/api/stripe/create-checkout', async (req, res) => {
  try {
    const { user_id, plan_type } = req.body; // plan_type: 'pro' yoki 'team'
    
    // Stripe Dashboard'dan olingan Price ID lar
    const prices = {
      pro: process.env.STRIPE_PRICE_PRO,   // masalan: price_1Nxxxxx... ($9/month)
      team: process.env.STRIPE_PRICE_TEAM, // masalan: price_1Nyyyyy... ($20/month)
    };

    if (!prices[plan_type]) {
      return res.status(400).json({ error: "Noto'g'ri tarif tanlandi" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: prices[plan_type],
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: plan_type === 'pro' ? 7 : 0, // Pro uchun 7 kunlik bepul sinov
      },
      // Webhook kelganda qaysi foydalanuvchi ekanligini bilish uchun:
      client_reference_id: user_id, 
      success_url: `${process.env.FRONTEND_URL}/zone?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/zone?canceled=true`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Checkout xatosi:", error);
    res.status(500).json({ error: "To'lov sahifasini yaratib bo'lmadi" });
  }
});

// 2. Webhook (Stripe'dan keladigan asinxron javoblarni qabul qilish)
// MUHIM: Webhook ishhlashi uchun express.raw() ishlatilishi shart, json() emas!
router.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Signaturani tekshirish (Xavfsizlik)
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook signature xatosi: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Hodisalarni boshqarish
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id;
        // TODO: Database'da foydalanuvchi tier'ini 'pro' qilib yangilash
        // await db.query("UPDATE users SET tier = 'pro' WHERE id = $1", [userId]);
        console.log(`✅ Foydalanuvchi ${userId} Pro tarifiga o'tdi!`);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        // TODO: Database'da foydalanuvchini topib, tier'ni 'free' ga tushirish
        // await db.query("UPDATE users SET tier = 'free' WHERE stripe_customer_id = $1", [subscription.customer]);
        console.log(`❌ Obuna bekor qilindi (Customer: ${subscription.customer})`);
        break;
      }
      default:
        console.log(`E'tiborsiz qoldirilgan event: ${event.type}`);
    }
    res.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).end();
  }
});

module.exports = router;