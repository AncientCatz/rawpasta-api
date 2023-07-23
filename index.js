const express = require('express');
const multer = require('multer');
const { randomBytes } = require('crypto');
const mongoose = require('mongoose');
const OTPAuth = require('otpauth');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('json spaces', 2)
app.use('/', express.static('public', {
  extension: ['html']
}));

// Retrieve MongoDB URI from system environment or use a default value
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rawpasta';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rawpasta', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/json', 'text/plain', 'application/xml', 'text/xml', 'application/x-yaml', 'text/yaml'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JSON, TXT, XML, and YAML files are allowed'));
  }
};

const upload = multer({ storage, fileFilter });

const fileSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileContent: {
    type: String,
    required: true,
  },
});

const File = mongoose.model('File', fileSchema);

const apiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  id: {
    type: String,
    required: true,
    unique: true,
  },
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

function errorHandler(err, req, res, next) {
  console.error('Error:', err.message); // Log only the error message
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({ error: message }); // Send JSON response to client
}

function authenticate(req, res, next) {
  const apiKey = req.headers.apikey || req.query.apiKey;
  if (!apiKey) {
    throw { statusCode: 401, message: 'API key is required' };
  }
  ApiKey.findOne({ key: apiKey })
    .then((key) => {
      if (!key) {
        throw { statusCode: 401, message: 'Invalid API key' };
      }
      next();
    })
    .catch((err) => {
      next(err);
    });
}

function generateRandomId(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let randomId = '';
  for (let i = 0; i < length; i++) {
    randomId += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return randomId;
}

function generateApiKey() {
  return randomBytes(16).toString('hex');
}

function generateFileId() {
  return generateRandomId(5);
}

function generateApiKeyID() {
  const randomHex = (Math.floor(Math.random() * 0xffffff)).toString(16);
  return '0x' + randomHex.padStart(6, '0');
}

app.get('/validate', (req, res, next) => {
  const totpToken = req.query.otp;

  if (!totpToken) {
    return res.status(400).json({ error: 'OTP (One-Time Password) is required' });
  }

  // Retrieve the TOTP secret from the system environment
  const totpSecret = process.env.TOTP_SECRET;

  // Create a TOTP instance
  const totp = new OTPAuth.TOTP({ secret: totpSecret, digits: 6, period: 30 });

  // Validate the provided OTP token with millisecond timestamp
  const timestamp = Date.now() + 30000;
  const isValidToken = totp.validate({ token: totpToken, timestamp });

  const response = {
    isValid: isValidToken ? 1 : 0,
    timestamp: timestamp,
  };

  res.json(response);
});

app.get('/health', (req, res) => {
  const uptime = process.uptime(); // Get the server uptime in seconds
  const status = uptime < 60 ? 'healthy' : 'degraded'; // Consider the server degraded if uptime is less than 60 seconds

  const response = {
    timestamp: Date.now(), // Current timestamp in milliseconds
    date: new Date().toISOString(),
    status,
    uptime: `${uptime.toFixed(2)} seconds`,
  };

  res.json(response);
});

app.post('/create-key', (req, res, next) => {
  const apiKeyId = generateApiKeyID();
  const apiKey = generateApiKey();
  const totpToken = req.query.otp;

  if (!totpToken) {
    throw { statusCode: 401, message: 'OTP (One-Time Password) is required' };
  }

  // Retrieve the TOTP secret from the system environment
  const totpSecret = process.env.TOTP_SECRET;

  // Create a TOTP instance
  const totp = new OTPAuth.TOTP({ secret: totpSecret, digits: 6, period: 30 });

  // Validate the provided OTP token with millisecond timestamp
  const timestamp = Date.now() + 30000;
  const isValidToken = totp.validate({ token: totpToken, timestamp });

  if (!isValidToken) {
    throw { statusCode: 401, message: 'Invalid OTP (One-Time Password)' };
  }

  const newApiKey = new ApiKey({ key: apiKey, id: apiKeyId });

  newApiKey
    .save()
    .then(() => {
      res.json([{ id: apiKeyId, key: apiKey, __v: 0 }]);
    })
    .catch((err) => {
      next(err);
    });
});

app.delete('/delete-key/:id?', authenticate, (req, res, next) => {
  if (!req.params.id) {
    console.warn('Missing required parameter: apiKeyId');
    const error = new Error('API Key ID is required');
    error.statusCode = 400;
    return next(error);
  }

  ApiKey.findOneAndDelete({ id: req.params.id })
    .then((apiKey) => {
      if (!apiKey) {
        console.warn('Invalid API Key ID');
        const error = new Error('Invalid API Key ID');
        error.statusCode = 400;
        return next(error);
      }

      res.json({ message: 'API key deleted successfully' });
    })
    .catch((err) => {
      next(err);
    });
});

app.get('/list-keys', authenticate, (req, res, next) => {
  ApiKey.find({}, 'key id')
    .then((keys) => {
      res.json(keys);
    })
    .catch((err) => {
      next(err);
    });
});

app.post('/upload', authenticate, upload.single('file'), (req, res, next) => {
  if (!req.file) {
    throw { statusCode: 400, message: 'No file uploaded' };
  }

  const fileName = req.query.fileName || req.body.fileName || generateRandomId(22);
  const overwrite = req.query.overwrite === 'true'; // Convert string to boolean
  const fileContent = req.file.buffer.toString('utf8');
  const fileId = generateFileId();

  const fileQuery = { fileName };

  File.findOne(fileQuery)
    .then((existingFile) => {
      if (existingFile && !overwrite) {
        throw { statusCode: 409, message: 'File name already exists' };
      }

      const newFile = new File({ id: fileId, fileName, fileContent });
      return newFile.save();
    })
    .then(() => {
      res.json({ id: fileId });
    })
    .catch((err) => {
      next(err);
    });
});

app.get('/raw/:identifier?', (req, res, next) => {
  const identifier = req.params.identifier;

  if (!identifier) {
    console.warn('Missing required parameter: identifier');
    const error = new Error('Identifier is required');
    error.statusCode = 400;
    return next(error);
  }

  // Check if the identifier matches a file ID or file name
  const idQuery = { id: identifier };
  const nameQuery = { fileName: identifier };

  File.findOne({ $or: [idQuery, nameQuery] })
    .then((file) => {
      if (!file) {
        console.warn('File not found');
        const error = new Error('File not found');
        error.statusCode = 404;
        return next(error);
      }

      res.json(file.fileContent);
    })
    .catch((err) => {
      next(err);
    });
});

app.get('/list', authenticate, (req, res, next) => {
  File.find({}, 'id fileName')
    .then((files) => {
      res.json(files);
    })
    .catch((err) => {
      next(err);
    });
});

app.put('/edit/:identifier?', authenticate, upload.single('file'), (req, res, next) => {
  const identifier = req.params.identifier;

  if (!identifier) {
    console.warn('Missing required parameter: identifier');
    const error = new Error('Identifier is required');
    error.statusCode = 400;
    return next(error);
  }

  if (!req.file) {
    console.warn('Missing required input: file');
    const error = new Error('File is required');
    error.statusCode = 400;
    return next(error);
  }

  const fileContent = req.file.buffer.toString('utf8');

  // Check if the identifier matches a file ID or file name
  const idQuery = { id: identifier };
  const nameQuery = { fileName: identifier };

  File.findOneAndUpdate(
    { $or: [idQuery, nameQuery] },
    { fileContent },
    { new: true }
  )
    .then((file) => {
      if (!file) {
        console.warn('File not found');
        const error = new Error('File not found');
        error.statusCode = 404;
        return next(error);
      }

      res.json({ message: 'File updated successfully' });
    })
    .catch((err) => {
      next(err);
    });
});

app.delete('/delete/:identifier?', authenticate, (req, res, next) => {
  const identifier = req.params.identifier;

  if (!identifier) {
    console.warn('Missing required parameter: identifier');
    const error = new Error('Identifier is required');
    error.statusCode = 400;
    return next(error);
  }

  // Check if the identifier matches a file ID or file name
  const idQuery = { id: identifier };
  const nameQuery = { fileName: identifier };

  File.findOne({ $or: [idQuery, nameQuery] })
    .then((file) => {
      if (!file) {
        console.warn('File not found');
        const error = new Error('File not found');
        error.statusCode = 404;
        return next(error);
      }

      return File.findOneAndDelete({ _id: file._id });
    })
    .then(() => {
      res.json({ message: 'File deleted successfully' });
    })
    .catch((err) => {
      next(err);
    });
});

//app.use((req, res, next) => {
//  const error = new Error('Method Not Allowed');
//  error.statusCode = 405;
//  next(error);
//});

app.use((req, res, next) => {
  if (req.path == '/' && req.method == 'GET') {
    next();
  } else {
    const error = new Error('Method Not Allowed');
    error.statusCode = 405;
    return next(error);
  }
  next();
});

app.use(errorHandler);

// Connect to the database before listening
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log('Server is running on port', PORT);
  });
});
