const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Initialize Express app
const app = express();
app.use(express.json()); // To parse JSON bodies

// MongoDB connection (replace with your connection string)
const MONGODB_URI = 'mongodb://localhost:27017/auctiondb';
const JWT_SECRET = 'your_jwt_secret_key';  // Set your secret key here

// MongoDB connection
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB connection error:', err));

// User Schema and Model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

// AuctionItem Schema and Model
const auctionItemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    startingBid: { type: Number, required: true },
    currentBid: { type: Number, default: 0 },
    highestBidder: { type: String, default: '' },
    endDate: { type: Date, required: true },
    isClosed: { type: Boolean, default: false }
});
const AuctionItem = mongoose.model('AuctionItem', auctionItemSchema);

// User Signup
app.post('/signup', async (req, res) => {
    const { username, password, email } = req.body;
    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({ username, password: hashedPassword, email });
        await newUser.save();

        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error creating user', error: err.message });
    }
});

// User Signin
app.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        // Create JWT token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

        res.json({ message: 'Signin successful', token });
    } catch (err) {
        res.status(500).json({ message: 'Error signing in', error: err.message });
    }
});

// Create Auction
app.post('/auction', async (req, res) => {
    const { title, description, startingBid, endDate } = req.body;
    try {
        const newAuction = new AuctionItem({ title, description, startingBid, endDate, currentBid: startingBid });
        await newAuction.save();
        res.status(201).json({ message: 'Auction created successfully', auction: newAuction });
    } catch (err) {
        res.status(500).json({ message: 'Error creating auction', error: err.message });
    }
});

// Get all Auctions
app.get('/auctions', async (req, res) => {
    try {
        const auctions = await AuctionItem.find();
        res.json(auctions);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching auctions', error: err.message });
    }
});

// Get Auction by ID
app.get('/auctions/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const auction = await AuctionItem.findById(id);
        if (!auction) return res.status(404).json({ message: 'Auction not found' });
        res.json(auction);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching auction', error: err.message });
    }
});

// Place a bid
app.post('/bid/:id', async (req, res) => {
    const { id } = req.params;
    const { bidAmount, bidderName } = req.body;

    try {
        const auction = await AuctionItem.findById(id);
        if (!auction) return res.status(404).json({ message: 'Auction not found' });

        // Check if bid is higher than current bid
        if (bidAmount <= auction.currentBid) {
            return res.status(400).json({ message: 'Bid must be higher than current bid' });
        }

        // Check if auction time is over
        const now = new Date();
        if (now > new Date(auction.endDate)) {
            auction.isClosed = true;
            await auction.save();
            return res.status(400).json({ message: 'Auction has ended' });
        }

        // Update bid and highest bidder
        auction.currentBid = bidAmount;
        auction.highestBidder = bidderName;
        await auction.save();

        res.json({ message: 'Bid placed successfully', auction });
    } catch (err) {
        res.status(500).json({ message: 'Error placing bid', error: err.message });
    }
});

// Edit Auction
app.put('/auction/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, startingBid, endDate } = req.body;

    try {
        const auction = await AuctionItem.findById(id);
        if (!auction) return res.status(404).json({ message: 'Auction not found' });

        // Update auction details
        auction.title = title || auction.title;
        auction.description = description || auction.description;
        auction.startingBid = startingBid || auction.startingBid;
        auction.endDate = endDate || auction.endDate;
        await auction.save();

        res.json({ message: 'Auction updated successfully', auction });
    } catch (err) {
        res.status(500).json({ message: 'Error updating auction', error: err.message });
    }
});

// Delete Auction
app.delete('/auction/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const auction = await AuctionItem.findById(id);
        if (!auction) return res.status(404).json({ message: 'Auction not found' });

        await auction.remove();
        res.json({ message: 'Auction deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting auction', error: err.message });
    }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
