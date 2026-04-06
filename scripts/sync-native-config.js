"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const contents = fs.readFileSync(filePath, "utf8");
  const result = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

const fileEnv = parseEnvFile(envPath);
const env = { ...fileEnv, ...process.env };

function getRequiredEnv(name) {
  const value = env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return String(value).trim();
}

function getOptionalEnv(name, fallback = "") {
  const value = env[name];
  if (value == null) {
    return fallback;
  }

  return String(value).trim();
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeFile(filePath, contents) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, contents, "utf8");
  console.log(`Wrote ${path.relative(projectRoot, filePath)}`);
}

function buildGoogleServicesJson() {
  const packageName = getRequiredEnv("ANDROID_FIREBASE_PACKAGE_NAME");
  const googleServices = {
    project_info: {
      project_number: getRequiredEnv("ANDROID_FIREBASE_PROJECT_NUMBER"),
      project_id: getRequiredEnv("ANDROID_FIREBASE_PROJECT_ID"),
      storage_bucket: getRequiredEnv("ANDROID_FIREBASE_STORAGE_BUCKET"),
    },
    client: [
      {
        client_info: {
          mobilesdk_app_id: getRequiredEnv("ANDROID_FIREBASE_MOBILE_SDK_APP_ID"),
          android_client_info: {
            package_name: packageName,
          },
        },
        oauth_client: [
          {
            client_id: getRequiredEnv("ANDROID_FIREBASE_ANDROID_CLIENT_ID_DEBUG"),
            client_type: 1,
            android_info: {
              package_name: packageName,
              certificate_hash: getRequiredEnv("ANDROID_FIREBASE_DEBUG_CERT_HASH"),
            },
          },
          {
            client_id: getRequiredEnv("ANDROID_FIREBASE_ANDROID_CLIENT_ID_RELEASE"),
            client_type: 1,
            android_info: {
              package_name: packageName,
              certificate_hash: getRequiredEnv("ANDROID_FIREBASE_RELEASE_CERT_HASH"),
            },
          },
          {
            client_id: getRequiredEnv("FIREBASE_WEB_CLIENT_ID"),
            client_type: 3,
          },
        ],
        api_key: [
          {
            current_key: getRequiredEnv("ANDROID_FIREBASE_API_KEY"),
          },
        ],
        services: {
          appinvite_service: {
            other_platform_oauth_client: [
              {
                client_id: getRequiredEnv("FIREBASE_WEB_CLIENT_ID"),
                client_type: 3,
              },
            ],
          },
        },
      },
    ],
    configuration_version: "1",
  };

  const outputPath = path.join(projectRoot, "android", "app", "google-services.json");
  writeFile(outputPath, `${JSON.stringify(googleServices, null, 2)}\n`);
}

function buildKeystoreProperties() {
  const requiredKeys = [
    "ANDROID_UPLOAD_STORE_FILE",
    "ANDROID_UPLOAD_KEY_ALIAS",
    "ANDROID_UPLOAD_STORE_PASSWORD",
    "ANDROID_UPLOAD_KEY_PASSWORD",
  ];

  const hasAnySigningValue = requiredKeys.some((key) => getOptionalEnv(key).length > 0);
  if (!hasAnySigningValue) {
    console.log("Skipped android/keystore.properties because signing environment variables are not set.");
    return;
  }

  const contents = [
    `MYAPP_UPLOAD_STORE_FILE=${getRequiredEnv("ANDROID_UPLOAD_STORE_FILE")}`,
    `MYAPP_UPLOAD_KEY_ALIAS=${getRequiredEnv("ANDROID_UPLOAD_KEY_ALIAS")}`,
    `MYAPP_UPLOAD_STORE_PASSWORD=${getRequiredEnv("ANDROID_UPLOAD_STORE_PASSWORD")}`,
    `MYAPP_UPLOAD_KEY_PASSWORD=${getRequiredEnv("ANDROID_UPLOAD_KEY_PASSWORD")}`,
    "",
  ].join("\n");

  const outputPath = path.join(projectRoot, "android", "keystore.properties");
  writeFile(outputPath, contents);
}

function main() {
  if (!fs.existsSync(envPath) && Object.keys(process.env).length === 0) {
    throw new Error("No environment variables are available. Create a .env file first.");
  }

  buildGoogleServicesJson();
  buildKeystoreProperties();
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`sync-native-config failed: ${message}`);
  process.exit(1);
}
