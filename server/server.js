require('dotenv').config();

const express= require('express')
const cors= require('cors');
const morgan=  require('morgan');
const {connectDB}= require('./configs/db.js');
const {connectCloudinary}= require('./configs/cloudinary.js');
const loginRouter= require('./routes/loginRoutes.js');
const educatorRouter= require('./routes/educatorRoutes.js');
const courseRouter = require('./routes/courseRoutes.js');
const userRouter = require('./routes/userRoutes.js');
const aiRouter = require('./routes/aiRoutes.js');

const PORT= process.env.PORT || 5000;

// API initializer
const app= express();

// Connect to Database
const startServer = async () => {
    try {
        // Ensure DB is connected before serving requests.
        await connectDB();

        // Connect to Cloudinary after env and DB are ready.
        connectCloudinary();

        app.listen(PORT, ()=>{
            console.log(`Server is running on port ${PORT}`);
        })
    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
};

//Middlewares
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

//API initialzer
app.get('/',(req, res)=>{
    res.status(200).json({message: "Welcome to Educaso API"});
})
app.use('/api', loginRouter);
app.use('/api/educator', educatorRouter);
app.use('/api/course', courseRouter);
app.use('/api/user', userRouter);
app.use('/api/ai', aiRouter);

startServer();