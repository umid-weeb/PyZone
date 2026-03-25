// Tariflar iyerarxiyasi (Katta raqam = ko'proq imkoniyat)
const TIER_LEVELS = {
  'free': 0,
  'pro': 1,
  'team': 2
};

function requireTier(minTier) {
  return (req, res, next) => {
    // req.user JWT middleware orqali o'rnatilgan bo'lishi kerak
    const userTier = req.user?.tier || 'free'; 
    
    const userLevel = TIER_LEVELS[userTier];
    const requiredLevel = TIER_LEVELS[minTier];

    if (userLevel >= requiredLevel) {
      return next(); // Ruxsat berilgan
    }

    // Ruxsat yo'q - Frontend Upgrade Modalni ochishi uchun maxsus 403 qaytaramiz
    return res.status(403).json({
      error: "Ushbu funksiya uchun obunani yangilashingiz kerak.",
      code: "UPGRADE_REQUIRED",
      required_tier: minTier,
      feature_name: req.path // qaysi funksiya ekanligini frontendga bildirish
    });
  };
}

module.exports = requireTier;