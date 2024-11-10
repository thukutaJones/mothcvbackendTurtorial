const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyparser = require("body-parser");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const User = require("./models/users.model");
const Transaction = require("./models/transactions.model");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: false }));

const hashPassword = async (password) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return hashedPassword;
};

app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const registredUser = await User.findOne({ email });
    console.log("in");

    if (registredUser) {
      return res.status(500).json({
        message: `E-mail: ${email} already registered`,
      });
    }

    console.log(req.body);
    const hashedPassword = await hashPassword(password);
    req.body.password = hashedPassword;

    const newUser = await new User(req.body);

    const secretKey = crypto.randomBytes(32).toString("hex");
    const token = jwt.sign({ userId: newUser._id }, secretKey);

    await newUser.save();
    res.status(200).json({
      message: "Success",
      newUser: {
        name: newUser.name,
        paid: newUser.paid,
        email: newUser.email,
      },
      token: token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(500).json({ message: "Invalid User" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(500).json({ message: "Incorrect Password" });
    }

    const secretKey = crypto.randomBytes(32).toString("hex");
    const token = jwt.sign({ userId: user._id }, secretKey);

    res.status(200).json({
      message: "Success",
      user: {
        name: user.name,
        paid: user.paid,
        email: user.email,
      },
      token: token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error });
  }
});

app.get("/getUserData/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id);
    const userData = await User.findOne({ _id: id });
    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({
      user: {
        name: userData.name,
        paid: userData.paid,
        email: userData.email,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error });
  }
});

app.post("/initilize-payment", async (req, res) => {
  const { phoneNumber, email, name, provider, amount } = req.body;
  const options = {
    method: "POST",
    url: "https://api.paychangu.com/mobile-money/payments/initialize",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: `Bearer ${process.env.PAYCHANGU_SECRET}`,
    },
    data: {
      mobile: phoneNumber,
      mobile_money_operator_ref_id: provider,
      amount: amount,
      charge_id: "" + Math.floor(Math.random() * 1000000000 + 1),
      email: email,
      first_name: name?.split(" ")[0],
      last_name: name?.split(" ")[1],
    },
  };
  try {
    const response = await axios.request(options);
    console.log(response.data);
    res.status(200).json({ data: response.data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error });
  }
});

app.get("/verify-charge/:chargeId", async (req, res) => {
  try {
    const { chargeId } = req.params;

    const response = await axios.get(
      `https://api.paychangu.com/mobile-money/payments/${chargeId}/verify`,
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          Authorization: `Bearer ${process.env.PAYCHANGU_SECRET}`,
        },
      }
    );

    console.log(response.data);
    res.status(200).json({ data: response?.data });
  } catch (error) {
    res.status(500).json({ message: error });
    console.log(error);
  }
});

app.post("/updatePaymentStatus", async (req, res) => {
  const { email } = req.body;
  console.log(email);
  const updatedUser = await User.findOneAndUpdate(
    { email },
    { paid: true },
    { new: true }
  );
  const transaction = await new Transaction(req.body);
  await transaction.save();
  res.status(200).json(updatedUser);
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log("Database connected succesfully 🎉🎉");
  app.listen(port, "0.0.0.0", () => {
    console.log(`Srver listening on port ${port}`);
  });
});
