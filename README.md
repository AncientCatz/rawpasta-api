# rawpasta-api

The rawpasta-api repository is a Node.js application that allows you to store text files in MongoDB. It provides an API for managing files and API keys with authentication and authorization mechanisms. The API supports file upload, retrieval, update, and deletion operations. The application uses the Express framework for handling HTTP requests, Multer for file uploading, Mongoose for MongoDB interaction, and OTPAuth for OTP (One-Time Password) validation.

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/AncientCatz/rawpasta-api.git
   ```
2. Navigate to the project directory:
   ```
   cd rawpasta-api
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Configuration

The rawpasta-api application can be configured using the following environment variables:

- `MONGODB_URI` (optional): The URI for the MongoDB database. If not provided, it defaults to `mongodb://localhost:27017/rawpasta`.
- `TOTP_SECRET` (required for OTP validation): The secret key used for generating and validating OTP tokens.

## Usage

To start the rawpasta-api server, run the following command:
```
npm start
```

The server will start running on port 3000, and you can access the API endpoints using a tool like cURL or Postman.

## API Endpoints

### `GET /validate`

This endpoint is used to validate an OTP (One-Time Password) token.

Query Parameters:
- `otp` (required): The OTP token to validate.

### `POST /create-key`

This endpoint is used to create a new API key.

Query Parameters:
- `otp` (required): The OTP token for authentication.

### `DELETE /delete-key/:id`

This endpoint is used to delete an API key by its ID.

Path Parameters:
- `id` (required): The ID of the API key to delete.

### `GET /list-keys`

This endpoint is used to retrieve a list of all API keys.

### `POST /upload`

This endpoint is used to upload a file.

Request Body:
- `file`: The file to upload.

Query Parameters:
- `fileName` (optional): The name to assign to the uploaded file.
- `overwrite` (optional): A boolean indicating whether to overwrite an existing file with the same name. Default is `false`.

### `GET /raw/:identifier`

This endpoint is used to retrieve the raw content of a file.

Path Parameters:
- `identifier` (required): The ID or name of the file to retrieve.

### `GET /list`

This endpoint is used to retrieve a list of all files.

### `PUT /edit/:identifier`

This endpoint is used to edit the content of a file.

Path Parameters:
- `identifier` (required): The ID or name of the file to edit.

Request Body:
- `file`: The updated content of the file.

### `DELETE /delete/:identifier`

This endpoint is used to delete a file.

Path Parameters:
- `identifier` (required): The ID or name of the file to delete.

## Error Handling

If an error occurs during the execution of an API endpoint, the server will respond with a JSON object containing an `error` property with the error message. The HTTP status code will indicate the type of error.

## Authentication

To access the protected endpoints (`/list-keys`, `/upload`, `/list`, `/edit/:identifier`, `/delete/:identifier`), you need to include an API key in the request headers (`apikey`) or query parameters (`apiKey`). The API key should be obtained by calling the `/create-key` endpoint.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.