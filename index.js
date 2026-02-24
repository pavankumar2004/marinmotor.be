    const express = require("express");
    const path = require("path");
    const { Storage } = require('@google-cloud/storage');
    const multer = require('multer');
    const basicAuth = require('basic-auth');
    const helmet = require('helmet');
    const rateLimit = require('express-rate-limit');
    const app = express();

    // --- Google Cloud Storage ---
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'keys.json');

    const storage = new Storage({
        projectId: 'meta-geography-433812-b8',
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
    const bucketName = 'cars-marin-motor';

    // --- Security headers with Helmet ---
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://cdn.jsdelivr.net",
                    "https://cdnjs.cloudflare.com",
                    "https://code.iconify.design",
                    "https://www.googletagmanager.com",
                    "https://www.google-analytics.com"
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://cdn.jsdelivr.net",
                    "https://cdnjs.cloudflare.com",
                    "https://fonts.googleapis.com",
                    "https://unpkg.com"
                ],
                imgSrc: ["'self'", "data:", "https://storage.googleapis.com", "https://www.google-analytics.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
                frameSrc: ["'self'", "https://www.google.com"],
                connectSrc: ["'self'", "https://api.iconify.design", "https://www.google-analytics.com"],
                objectSrc: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: false
    }));

    // --- Static files with cache headers ---
    app.use(express.static(path.join(__dirname, 'public'), {
        maxAge: '7d',
        etag: true
    }));

    // --- Body parsing ---
    app.use(express.json({ limit: '200mb' }));
    app.use(express.urlencoded({ limit: '200mb', extended: true }));

    const port = process.env.PORT || 4000;

    // --- Rate limiting ---
    const generalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: 'Too many requests, please try again later.'
    });

    const adminLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: 'Too many admin requests, please try again later.'
    });

    app.use('/admin', adminLimiter);
    app.use('/api', generalLimiter);
    app.use('/products', generalLimiter);

    // --- In-memory cache for products.json ---
    let productsCache = null;
    let productsCacheTime = 0;
    const CACHE_TTL = 60 * 1000; // 60 seconds

    async function getProducts(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && productsCache && (now - productsCacheTime) < CACHE_TTL) {
            return productsCache;
        }
        const [file] = await storage.bucket(bucketName).file('products.json').download();
        const data = file.toString('utf8');
        productsCache = JSON.parse(data);
        productsCacheTime = now;
        return productsCache;
    }

    function invalidateCache() {
        productsCache = null;
        productsCacheTime = 0;
    }

    // --- Multer configuration with file type validation ---
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: (req, file, cb) => {
            if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed.'));
            }
        }
    });

    // --- Basic authentication middleware ---
    const adminAuth = (req, res, next) => {
        const user = basicAuth(req);
        if (!user || user.name !== 'admin' || user.pass !== 'password') {
            res.set('WWW-Authenticate', 'Basic realm="Admin"');
            return res.status(401).send('Authentication required.');
        }
        next();
    };

    // --- Maintenance mode ---
    let maintenanceMode = false;

    const checkMaintenance = (req, res, next) => {
        if (maintenanceMode && !req.path.startsWith('/admin')) {
            return res.sendFile(path.join(__dirname, 'views', 'maintenance.html'));
        }
        next();
    };

    app.use(checkMaintenance);

    // --- Public routes ---
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'index.html'));
    });
    app.get('/atlier', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'atlier.html'));
    });
    app.get('/listing', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'listing.html'));
    });
    app.get('/contact', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'contact.html'));
    });
    app.get('/view-products', (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'view-products.html'));
    });

    // --- Products API (cached) ---
    app.get('/products', async (req, res) => {
        try {
            const products = await getProducts();
            res.json(products);
        } catch (err) {
            console.error('Error reading products file:', err);
            res.status(500).send('Error reading products file');
        }
    });

    app.get('/listing/:id', async (req, res) => {
        const productId = req.params.id;
        try {
            const products = await getProducts();
            const product = products.find(p => p.id === productId);
            if (!product) {
                return res.status(404).send('Product not found');
            }
            res.sendFile(path.join(__dirname, 'views', 'car-single.html'));
        } catch (err) {
            console.error('Error reading products file:', err);
            res.status(500).send('Error reading products file');
        }
    });

    app.get('/api/products/:id', async (req, res) => {
        const productId = req.params.id;
        try {
            const products = await getProducts();
            const product = products.find(p => p.id === productId);
            if (!product) {
                return res.status(404).send('Product not found');
            }
            res.json(product);
        } catch (err) {
            console.error('Error reading products file:', err);
            res.status(500).send('Error reading products file');
        }
    });

    // --- Admin routes ---
    app.get('/admin', adminAuth, (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'admin.html'));
    });

    app.get('/admin/maintenance-status', adminAuth, (req, res) => {
        res.json({ maintenanceMode });
    });

    app.post('/admin/toggle-maintenance', adminAuth, (req, res) => {
        maintenanceMode = !maintenanceMode;
        res.json({ maintenanceMode, message: `Maintenance mode ${maintenanceMode ? 'enabled' : 'disabled'}` });
    });

    app.post('/admin/add', adminAuth, upload.single('pimage'), async (req, res) => {
        const newProduct = req.body;
        try {
            const products = await getProducts(true);

            if (products.some(p => p.id === newProduct.id)) {
                return res.status(400).send('Product ID already exists');
            }

            if (req.file) {
                const blob = storage.bucket(bucketName).file(`images/${Date.now()}-${req.file.originalname}`);
                const blobStream = blob.createWriteStream();
                blobStream.end(req.file.buffer);
                await new Promise((resolve, reject) => {
                    blobStream.on('finish', resolve);
                    blobStream.on('error', reject);
                });
                newProduct.pimage = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
            }

            products.push(newProduct);
            await storage.bucket(bucketName).file('products.json').save(JSON.stringify(products, null, 2));
            invalidateCache();
            res.status(201).send('Product added successfully');
        } catch (err) {
            console.error('Error updating products file:', err);
            res.status(500).send('Error updating products file');
        }
    });

    app.post('/admin/add-display-image/:id', adminAuth, upload.single('display_image'), async (req, res) => {
        const productId = req.params.id;
        try {
            const products = await getProducts(true);
            const product = products.find(p => p.id === productId);
            if (!product) {
                return res.status(404).send('Product not found');
            }

            if (req.file) {
                const blob = storage.bucket(bucketName).file(`images/${Date.now()}-${req.file.originalname}`);
                const blobStream = blob.createWriteStream();
                blobStream.end(req.file.buffer);
                await new Promise((resolve, reject) => {
                    blobStream.on('finish', resolve);
                    blobStream.on('error', reject);
                });
                product.display_image = product.display_image || [];
                product.display_image.push(`https://storage.googleapis.com/${bucketName}/${blob.name}`);
            }
            await storage.bucket(bucketName).file('products.json').save(JSON.stringify(products, null, 2));
            invalidateCache();
            res.status(201).send('Display image added successfully');
        } catch (err) {
            console.error('Error updating products file:', err);
            res.status(500).send('Error updating products file');
        }
    });

    app.put('/admin/update/:id', adminAuth, async (req, res) => {
        const productId = req.params.id;
        const updatedPrice = req.body.price;

        if (!updatedPrice) {
            return res.status(400).send('Price is required');
        }

        // Validate price is a valid number
        const priceNum = parseFloat(updatedPrice);
        if (isNaN(priceNum) || priceNum < 0) {
            return res.status(400).send('Price must be a valid positive number');
        }

        try {
            const products = await getProducts(true);
            const productIndex = products.findIndex(p => p.id === productId);

            if (productIndex === -1) {
                return res.status(404).send('Product not found');
            }

            products[productIndex].price = updatedPrice;
            await storage.bucket(bucketName).file('products.json').save(JSON.stringify(products, null, 2));
            invalidateCache();
            res.send('Product price updated successfully');
        } catch (err) {
            console.error('Error updating products file:', err);
            res.status(500).send('Error updating products file');
        }
    });

    app.delete('/admin/delete/:id', adminAuth, async (req, res) => {
        const productId = req.params.id;
        try {
            let products = await getProducts(true);
            const product = products.find(p => p.id === productId);
            if (!product) {
                return res.status(404).send('Product not found');
            }
            const deleteFile = async (filePath) => {
                await storage.bucket(bucketName).file(filePath).delete();
                console.log(`Deleted file: ${filePath}`);
            };
            if (product.pimage) {
                await deleteFile(product.pimage.replace(`https://storage.googleapis.com/${bucketName}/`, ''));
            }
            if (product.display_image && product.display_image.length > 0) {
                for (const imagePath of product.display_image) {
                    await deleteFile(imagePath.replace(`https://storage.googleapis.com/${bucketName}/`, ''));
                }
            }
            products = products.filter(p => p.id !== productId);
            await storage.bucket(bucketName).file('products.json').save(JSON.stringify(products, null, 2));
            invalidateCache();
            res.send('Product deleted successfully');
        } catch (err) {
            console.error('Error updating products file:', err);
            res.status(500).send('Error updating products file');
        }
    });

    app.delete('/admin/delete-images/:id', adminAuth, async (req, res) => {
        const productId = req.params.id;
        try {
            let products = await getProducts(true);
            const product = products.find(p => p.id === productId);
            if (!product) {
                return res.status(404).send('Product not found');
            }
            const deleteFile = async (filePath) => {
                await storage.bucket(bucketName).file(filePath).delete();
                console.log(`Deleted file: ${filePath}`);
            };
            if (product.pimage) {
                await deleteFile(product.pimage.replace(`https://storage.googleapis.com/${bucketName}/`, ''));
                delete product.pimage;
            }
            if (product.display_image && product.display_image.length > 0) {
                for (const imagePath of product.display_image) {
                    await deleteFile(imagePath.replace(`https://storage.googleapis.com/${bucketName}/`, ''));
                }
                delete product.display_image;
            }

            await storage.bucket(bucketName).file('products.json').save(JSON.stringify(products, null, 2));
            invalidateCache();
            res.send('Product images deleted successfully');
        } catch (err) {
            console.error('Error deleting product images:', err);
            res.status(500).send('Error deleting product images');
        }
    });

    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
