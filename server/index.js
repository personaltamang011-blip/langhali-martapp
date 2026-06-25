import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "246810";

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: Number, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true },
    status: { type: String, default: "Pending" },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.error("MongoDB connection error:", error.message));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Langhali Mart API" });
});

app.post("/api/orders", async (req, res) => {
  try {
    const { customerName, phone, address, items } = req.body;

    if (!customerName || !phone || !address) {
      return res.status(400).json({ message: "Customer name, phone, and address are required." });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Please add at least one product to cart." });
    }

    const cleanItems = items.map((item) => ({
      productId: Number(item.productId),
      name: String(item.name),
      price: Number(item.price),
      image: String(item.image),
      quantity: Math.max(1, Number(item.quantity) || 1),
    }));

    const total = cleanItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order = await Order.create({ customerName, phone, address, items: cleanItems, total });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/orders", async (req, res) => {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Invalid admin password." });
  }

  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

app.put("/api/orders/:id", async (req, res) => {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Invalid admin password." });
  }

  try {
    const { customerName, phone, address, status, items } = req.body;
    const total = Array.isArray(items)
      ? items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)
      : undefined;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { customerName, phone, address, status, items, ...(total !== undefined ? { total } : {}) },
      { new: true, runValidators: true }
    );

    if (!order) return res.status(404).json({ message: "Order not found." });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/orders/:id", async (req, res) => {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Invalid admin password." });
  }

  await Order.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Langhali Mart API running on http://127.0.0.1:${PORT}`);
});
