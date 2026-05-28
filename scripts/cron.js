setInterval(async () => {
  try {
    await fetch("http://localhost:3000/api/cron/cart-abandonment", {
      headers: {
        Authorization: "Bearer super_secret_key_123456",
      },
    });
    console.log("Cron executed");
  } catch (e) {
    console.error(e);
  }
}, 10 * 60 * 1000); // هر 10 دقیقه