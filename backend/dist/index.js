"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("./routes/auth"));
const admin_1 = __importDefault(require("./routes/admin"));
const courses_1 = __importDefault(require("./routes/courses"));
const lectures_1 = __importDefault(require("./routes/lectures"));
const materials_1 = __importDefault(require("./routes/materials"));
const tests_1 = __importDefault(require("./routes/tests"));
const profile_1 = __importDefault(require("./routes/profile"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const superuser_1 = __importDefault(require("./routes/superuser"));
const payments_1 = __importDefault(require("./routes/payments"));
const firestoreListener_1 = require("./services/firestoreListener");
const scheduler_1 = require("./services/scheduler");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Start Firestore real-time sync listener
(0, firestoreListener_1.startFirestoreListener)();
// Start Daily Cron Scheduler
(0, scheduler_1.startScheduler)();
// Middleware configurations
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((req, res, next) => {
    console.log(`[HTTP Request] ${req.method} ${req.url}`, req.method === 'POST' || req.method === 'PUT' ? req.body : '');
    const oldJson = res.json;
    res.json = function (data) {
        console.log(`[HTTP Response] ${req.method} ${req.url} - Status: ${res.statusCode}`);
        return oldJson.apply(res, arguments);
    };
    next();
});
const reportBuilder_1 = require("./services/reportBuilder");
const fs_1 = __importDefault(require("fs"));
// Routes Bindings
app.get('/uploads/reports/:filename', async (req, res, next) => {
    try {
        const { filename } = req.params;
        const filePath = path_1.default.join(__dirname, '../uploads/reports', filename);
        if (!fs_1.default.existsSync(filePath)) {
            const match = filename.match(/^attendance-report-(\d{4}-\d{2}-\d{2})\.pdf$/);
            if (match) {
                const date = match[1];
                console.log(`[Report Rebuilder] Regenerating missing daily report for date: ${date}`);
                await (0, reportBuilder_1.generateDailyReport)(date);
            }
        }
    }
    catch (error) {
        console.error('[Report Rebuilder Error]', error);
    }
    next();
});
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Routes Bindings
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/admin', admin_1.default);
app.use('/api/v1/courses', courses_1.default);
app.use('/api/v1/lectures', lectures_1.default);
app.use('/api/v1/materials', materials_1.default);
app.use('/api/v1/tests', tests_1.default);
app.use('/api/v1/profile', profile_1.default);
app.use('/api/v1/attendance', attendance_1.default);
app.use('/api/v1/superuser', superuser_1.default);
app.use('/api/v1/payments', payments_1.default);
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});
// Centralized error handling middleware
app.use((err, req, res, next) => {
    console.error('[Error Handler]', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal Server Error',
    });
});
app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`Mathemaniac Node Express API is live on port: ${PORT}`);
    console.log(`===================================================`);
});
exports.default = app;
