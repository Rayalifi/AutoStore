const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    priceWl: { type: Number, default: 0 },
    currency: { type: String, enum: ['rupiah', 'wl'], default: 'rupiah' }, // Mata uang: rupiah atau wl
    description: { type: String, default: "Tidak ada deskripsi" }, // Untuk deskripsi
    roleId: { type: String, default: null }, // BARU: Untuk menyimpan ID Role
    stock: [String], 
    minBuy: { type: Number, default: 1 },
    sold: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
});

module.exports = mongoose.model('Product', ProductSchema);