const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 6 },
    googleId: { type: String, sparse: true, unique: true },
    kakaoId: { type: String, sparse: true, unique: true },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: "Team" }],
    weeklyFreeTime: [{
      day: { type: Number, min: 0, max: 6 }, // 0=일 ~ 6=토
      start: { type: String }, // "HH:MM"
      end: { type: String },   // "HH:MM"
    }],
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("User", userSchema);
