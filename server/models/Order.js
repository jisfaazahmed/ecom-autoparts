import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
    buyerName: String,
    buyerEmail: String,
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: Number,
        price: Number
      }
    ],
    totalAmount: Number,
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
      default: "PENDING"
    },
    shippingAddress: String
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;