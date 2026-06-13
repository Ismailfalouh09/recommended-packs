# API Curl Tests

These examples assume the backend is running at `http://localhost:3000`.

Before testing admin auth, configure local auth environment variables and run:

```powershell
npm run admin:create
```

## Windows PowerShell

### GET /attributes

```powershell
curl.exe http://localhost:3000/attributes
```

### GET /attributes/SKIN_COLOR/options

```powershell
curl.exe http://localhost:3000/attributes/SKIN_COLOR/options
```

### GET /quiz/questions

```powershell
curl.exe http://localhost:3000/quiz/questions
```

### GET /products

```powershell
curl.exe http://localhost:3000/products
```

### GET /packs

```powershell
curl.exe http://localhost:3000/packs
```

### POST /quiz/profiles

```powershell
curl.exe -X POST http://localhost:3000/quiz/profiles `
  -H "Content-Type: application/json" `
  -d "{\"sourceChannel\":\"INSTAGRAM\",\"answers\":[{\"attributeGroupCode\":\"SKIN_COLOR\",\"attributeOptionCode\":\"MEDIUM\"},{\"attributeGroupCode\":\"UNDERTONE\",\"attributeOptionCode\":\"WARM\"},{\"attributeGroupCode\":\"SKIN_TYPE\",\"attributeOptionCode\":\"OILY\"},{\"attributeGroupCode\":\"STYLE\",\"attributeOptionCode\":\"NATURAL\"},{\"attributeGroupCode\":\"BUDGET\",\"attributeOptionCode\":\"MEDIUM\"}]}"
```

Copy the `customerProfileId` from the response.

### POST /recommendations

Replace `CUSTOMER_PROFILE_ID_HERE` with the `customerProfileId` returned from `POST /quiz/profiles`.

```powershell
curl.exe -X POST http://localhost:3000/recommendations `
  -H "Content-Type: application/json" `
  -d "{\"customerProfileId\":\"CUSTOMER_PROFILE_ID_HERE\"}"
```

Copy the `sessionId` from the response.
Copy a `recommendationResultId` from `recommendedPacks[0].recommendationResultId` for order creation.

### GET /recommendations/:sessionId

Replace `SESSION_ID_HERE` with the `sessionId` returned from `POST /recommendations`.

```powershell
curl.exe http://localhost:3000/recommendations/SESSION_ID_HERE
```

### POST /orders

Replace `RECOMMENDATION_RESULT_ID_HERE` with a `recommendationResultId` returned from `POST /recommendations`.

```powershell
curl.exe -X POST http://localhost:3000/orders `
  -H "Content-Type: application/json" `
  -d "{\"recommendationResultId\":\"RECOMMENDATION_RESULT_ID_HERE\",\"fullName\":\"Sara\",\"phone\":\"0600000000\",\"whatsappPhone\":\"0600000000\",\"city\":\"Casablanca\",\"addressLine\":\"Maarif\",\"extraInfo\":\"Near the pharmacy\",\"notes\":\"Call before delivery\"}"
```

Copy the `orderId` from the response.

### GET /orders/:id

Replace `ORDER_ID_HERE` with the `orderId` returned from `POST /orders`.

```powershell
curl.exe http://localhost:3000/orders/ORDER_ID_HERE
```

Public order lookup returns a safe summary only. Use the admin endpoints below for full customer, address, item, and status-history data.

### POST /auth/login

Replace the email and password with your configured local admin credentials.

```powershell
curl.exe -X POST http://localhost:3000/auth/login `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"admin@example.com\",\"password\":\"change-this-password\"}"
```

Copy the `accessToken` from the response.

### GET /auth/me

Replace `ACCESS_TOKEN_HERE` with the token returned from `POST /auth/login`.

```powershell
curl.exe http://localhost:3000/auth/me `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### GET /admin/orders

Replace `ACCESS_TOKEN_HERE`. Optional filters include `search`, `orderStatus`, `paymentStatus`, `paymentMethod`, `selectedPackId`, `sourceChannel`, `createdFrom`, `createdTo`, `minTotal`, `maxTotal`, `sortBy`, and `sortOrder`.

```powershell
curl.exe "http://localhost:3000/admin/orders?page=1&pageSize=20&search=0600000000" `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### GET /admin/orders/:id

Replace `ORDER_ID_HERE` and `ACCESS_TOKEN_HERE`.

```powershell
curl.exe http://localhost:3000/admin/orders/ORDER_ID_HERE `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### PATCH /admin/orders/:id/status

Replace `ORDER_ID_HERE` and `ACCESS_TOKEN_HERE`. Valid workflow examples are `CONFIRMED`, `PREPARING`, `SHIPPED`, `DELIVERED`, `RETURNED`, and `CANCELED`, depending on the current order status.

```powershell
curl.exe -X PATCH http://localhost:3000/admin/orders/ORDER_ID_HERE/status `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"status\":\"CONFIRMED\",\"comment\":\"Confirmed by phone\"}"
```

```powershell
curl.exe -X PATCH http://localhost:3000/admin/orders/ORDER_ID_HERE/status `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"status\":\"PREPARING\",\"comment\":\"Preparing package\"}"
```

```powershell
curl.exe -X PATCH http://localhost:3000/admin/orders/ORDER_ID_HERE/status `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"status\":\"SHIPPED\",\"comment\":\"Handed to delivery\"}"
```

```powershell
curl.exe -X PATCH http://localhost:3000/admin/orders/ORDER_ID_HERE/status `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"status\":\"DELIVERED\",\"comment\":\"Delivered and COD collected\"}"
```

For a delivered COD order, `DELIVERED` marks payment as `PAID`. If the order is later returned, use:

```powershell
curl.exe -X PATCH http://localhost:3000/admin/orders/ORDER_ID_HERE/status `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"status\":\"RETURNED\",\"comment\":\"Customer returned the order\"}"
```

### GET /admin/categories

```powershell
curl.exe "http://localhost:3000/admin/categories?page=1&pageSize=20" `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### POST /admin/categories

```powershell
curl.exe -X POST http://localhost:3000/admin/categories `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"code\":\"FOUNDATION_ADMIN\",\"name\":\"Foundation Admin\",\"description\":\"Face foundation products\",\"sortOrder\":1,\"isActive\":true}"
```

Copy the category `id` from the response.

### POST /admin/brands

```powershell
curl.exe -X POST http://localhost:3000/admin/brands `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"name\":\"Admin Demo Beauty\",\"description\":\"Demo brand\",\"isActive\":true}"
```

Copy the brand `id` from the response.

### POST /admin/products

Replace `CATEGORY_ID_HERE` and `BRAND_ID_HERE`.

```powershell
curl.exe -X POST http://localhost:3000/admin/products `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"categoryId\":\"CATEGORY_ID_HERE\",\"brandId\":\"BRAND_ID_HERE\",\"name\":\"Admin Foundation X\",\"slug\":\"admin-foundation-x\",\"description\":\"Demo foundation\",\"basePrice\":120,\"costPrice\":70,\"currency\":\"MAD\",\"status\":\"ACTIVE\",\"isActive\":true}"
```

Copy the product `id` from the response.

### POST /admin/products/:productId/references

Replace `PRODUCT_ID_HERE`.

```powershell
curl.exe -X POST http://localhost:3000/admin/products/PRODUCT_ID_HERE/references `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"referenceCode\":\"RF2\",\"referenceName\":\"Medium Warm\",\"sku\":\"ADMIN-FOUNDATION-X-RF2\",\"priceDelta\":0,\"stockQuantity\":20,\"reservedQuantity\":0,\"lowStockThreshold\":5,\"isDefault\":true,\"isActive\":true,\"attributes\":[{\"attributeGroupCode\":\"SKIN_COLOR\",\"attributeOptionCode\":\"MEDIUM\",\"matchType\":\"COMPATIBLE\",\"scoreValue\":40,\"isHardFilter\":false},{\"attributeGroupCode\":\"UNDERTONE\",\"attributeOptionCode\":\"WARM\",\"matchType\":\"COMPATIBLE\",\"scoreValue\":25,\"isHardFilter\":false}]}"
```

Copy the reference `id` from the response.

### PATCH /admin/product-references/:id/stock

Replace `REFERENCE_ID_HERE`.

```powershell
curl.exe -X PATCH http://localhost:3000/admin/product-references/REFERENCE_ID_HERE/stock `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"stockQuantity\":30,\"reservedQuantity\":2,\"lowStockThreshold\":5}"
```

### GET /admin/products/:id

Replace `PRODUCT_ID_HERE`.

```powershell
curl.exe http://localhost:3000/admin/products/PRODUCT_ID_HERE `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### DELETE /admin/products/:id

Replace `PRODUCT_ID_HERE`. This archives the product and deactivates references.

```powershell
curl.exe -X DELETE http://localhost:3000/admin/products/PRODUCT_ID_HERE `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### GET /admin/packs

```powershell
curl.exe "http://localhost:3000/admin/packs?page=1&pageSize=20" `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### POST /admin/packs

Creates a draft pack. Draft packs may be created before items are attached.

```powershell
curl.exe -X POST http://localhost:3000/admin/packs `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"name\":\"Admin Natural Pack\",\"slug\":\"admin-natural-pack\",\"description\":\"Admin-created pack\",\"priceMode\":\"FIXED\",\"fixedPrice\":249,\"minBudget\":200,\"maxBudget\":350,\"currency\":\"MAD\",\"priority\":10,\"status\":\"DRAFT\",\"isActive\":false}"
```

Copy the pack `id` from the response.

### PATCH /admin/packs/:id

Replace `PACK_ID_HERE`, `FOUNDATION_PRODUCT_ID_HERE`, `MASCARA_PRODUCT_ID_HERE`, and `MASCARA_REFERENCE_ID_HERE`.

```powershell
curl.exe -X PATCH http://localhost:3000/admin/packs/PACK_ID_HERE `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"status\":\"ACTIVE\",\"isActive\":true,\"fixedPrice\":249,\"items\":[{\"productId\":\"FOUNDATION_PRODUCT_ID_HERE\",\"selectionMode\":\"AUTO_BEST_REFERENCE\",\"quantity\":1,\"isRequired\":true,\"sortOrder\":1},{\"productId\":\"MASCARA_PRODUCT_ID_HERE\",\"productReferenceId\":\"MASCARA_REFERENCE_ID_HERE\",\"selectionMode\":\"FIXED_REFERENCE\",\"quantity\":1,\"isRequired\":true,\"sortOrder\":2}],\"attributes\":[{\"attributeGroupCode\":\"STYLE\",\"attributeOptionCode\":\"NATURAL\",\"matchType\":\"COMPATIBLE\",\"scoreValue\":20,\"isHardFilter\":false},{\"attributeGroupCode\":\"BUDGET\",\"attributeOptionCode\":\"MEDIUM\",\"matchType\":\"COMPATIBLE\",\"scoreValue\":10,\"isHardFilter\":false}]}"
```

### GET /admin/packs/:id

Replace `PACK_ID_HERE`.

```powershell
curl.exe http://localhost:3000/admin/packs/PACK_ID_HERE `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### DELETE /admin/packs/:id

Replace `PACK_ID_HERE`. This archives the pack without deleting pack items or attributes.

```powershell
curl.exe -X DELETE http://localhost:3000/admin/packs/PACK_ID_HERE `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### POST /admin/attributes

```powershell
curl.exe -X POST http://localhost:3000/admin/attributes `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"code\":\"COVERAGE\",\"name\":\"Coverage\",\"description\":\"Preferred makeup coverage\",\"isCustomerAttribute\":true,\"isProductAttribute\":true,\"sortOrder\":6,\"isActive\":true}"
```

Copy the attribute group `id`.

### POST /admin/attributes/:attributeGroupId/options

Replace `ATTRIBUTE_GROUP_ID_HERE`.

```powershell
curl.exe -X POST http://localhost:3000/admin/attributes/ATTRIBUTE_GROUP_ID_HERE/options `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"code\":\"FULL\",\"label\":\"Full Coverage\",\"description\":\"Maximum makeup coverage\",\"sortOrder\":3,\"isActive\":true}"
```

Copy option IDs for quiz mappings.

### POST /admin/quiz/questions

Replace `ATTRIBUTE_GROUP_ID_HERE` and `ATTRIBUTE_OPTION_ID_HERE`.

```powershell
curl.exe -X POST http://localhost:3000/admin/quiz/questions `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"attributeGroupId\":\"ATTRIBUTE_GROUP_ID_HERE\",\"questionText\":\"What coverage do you prefer?\",\"helperText\":\"Choose your preferred result\",\"selectionType\":\"SINGLE\",\"isRequired\":true,\"stepOrder\":6,\"isActive\":false,\"options\":[{\"attributeOptionId\":\"ATTRIBUTE_OPTION_ID_HERE\",\"sortOrder\":1,\"isActive\":true}]}"
```

Copy the quiz question `id`.

### PATCH /admin/quiz/questions/:id

Replace `QUIZ_QUESTION_ID_HERE`.

```powershell
curl.exe -X PATCH http://localhost:3000/admin/quiz/questions/QUIZ_QUESTION_ID_HERE `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"isActive\":true}"
```

### POST /admin/recommendation-rules

Replace `ATTRIBUTE_GROUP_ID_HERE`.

```powershell
curl.exe -X POST http://localhost:3000/admin/recommendation-rules `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"code\":\"COVERAGE_MATCH\",\"name\":\"Coverage match\",\"targetType\":\"PACK\",\"attributeGroupId\":\"ATTRIBUTE_GROUP_ID_HERE\",\"conditionType\":\"SHOULD_MATCH\",\"scoreValue\":15,\"weight\":1,\"isActive\":true}"
```

Copy the recommendation rule `id`.

### POST /admin/recommendation-rules/preview

Replace `CUSTOMER_PROFILE_ID_HERE`.

```powershell
curl.exe -X POST http://localhost:3000/admin/recommendation-rules/preview `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"customerProfileId\":\"CUSTOMER_PROFILE_ID_HERE\"}"
```

### DELETE /admin/recommendation-rules/:id

Replace `RECOMMENDATION_RULE_ID_HERE`.

```powershell
curl.exe -X DELETE http://localhost:3000/admin/recommendation-rules/RECOMMENDATION_RULE_ID_HERE `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### POST /admin/media/upload

Replace `C:\path\to\image.jpg` with a local JPEG, PNG, WEBP, or AVIF image path. Cloudinary environment variables must be configured in `.env`; do not commit real credentials.

```powershell
curl.exe -X POST http://localhost:3000/admin/media/upload `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -F "file=@C:\path\to\image.jpg" `
  -F "folder=recommended-packs/products" `
  -F "altText=Foundation bottle shade medium warm" `
  -F "usageContext=PRODUCT_MAIN_IMAGE"
```

Copy the media asset `id`.

### GET /admin/media

```powershell
curl.exe "http://localhost:3000/admin/media?page=1&pageSize=20&search=foundation" `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### GET /admin/media/:id

Replace `MEDIA_ASSET_ID_HERE`.

```powershell
curl.exe http://localhost:3000/admin/media/MEDIA_ASSET_ID_HERE `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### PATCH /admin/media/:id

Replace `MEDIA_ASSET_ID_HERE`.

```powershell
curl.exe -X PATCH http://localhost:3000/admin/media/MEDIA_ASSET_ID_HERE `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" `
  -H "Content-Type: application/json" `
  -d "{\"altText\":\"Updated image description\",\"usageContext\":\"PACK_MAIN_IMAGE\"}"
```

### DELETE /admin/media/:id

Replace `MEDIA_ASSET_ID_HERE`. This deletes the Cloudinary image and soft-deletes the local media record.

```powershell
curl.exe -X DELETE http://localhost:3000/admin/media/MEDIA_ASSET_ID_HERE `
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

## Windows CMD

### GET /attributes

```cmd
curl http://localhost:3000/attributes
```

### GET /attributes/SKIN_COLOR/options

```cmd
curl http://localhost:3000/attributes/SKIN_COLOR/options
```

### GET /quiz/questions

```cmd
curl http://localhost:3000/quiz/questions
```

### GET /products

```cmd
curl http://localhost:3000/products
```

### GET /packs

```cmd
curl http://localhost:3000/packs
```

### POST /quiz/profiles

```cmd
curl -X POST http://localhost:3000/quiz/profiles -H "Content-Type: application/json" -d "{\"sourceChannel\":\"INSTAGRAM\",\"answers\":[{\"attributeGroupCode\":\"SKIN_COLOR\",\"attributeOptionCode\":\"MEDIUM\"},{\"attributeGroupCode\":\"UNDERTONE\",\"attributeOptionCode\":\"WARM\"},{\"attributeGroupCode\":\"SKIN_TYPE\",\"attributeOptionCode\":\"OILY\"},{\"attributeGroupCode\":\"STYLE\",\"attributeOptionCode\":\"NATURAL\"},{\"attributeGroupCode\":\"BUDGET\",\"attributeOptionCode\":\"MEDIUM\"}]}"
```

Copy the `customerProfileId` from the response.

### POST /recommendations

Replace `CUSTOMER_PROFILE_ID_HERE` with the `customerProfileId` returned from `POST /quiz/profiles`.

```cmd
curl -X POST http://localhost:3000/recommendations -H "Content-Type: application/json" -d "{\"customerProfileId\":\"CUSTOMER_PROFILE_ID_HERE\"}"
```

Copy the `sessionId` from the response.
Copy a `recommendationResultId` from `recommendedPacks[0].recommendationResultId` for order creation.

### GET /recommendations/:sessionId

Replace `SESSION_ID_HERE` with the `sessionId` returned from `POST /recommendations`.

```cmd
curl http://localhost:3000/recommendations/SESSION_ID_HERE
```

### POST /orders

Replace `RECOMMENDATION_RESULT_ID_HERE` with a `recommendationResultId` returned from `POST /recommendations`.

```cmd
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" -d "{\"recommendationResultId\":\"RECOMMENDATION_RESULT_ID_HERE\",\"fullName\":\"Sara\",\"phone\":\"0600000000\",\"whatsappPhone\":\"0600000000\",\"city\":\"Casablanca\",\"addressLine\":\"Maarif\",\"extraInfo\":\"Near the pharmacy\",\"notes\":\"Call before delivery\"}"
```

Copy the `orderId` from the response.

### GET /orders/:id

Replace `ORDER_ID_HERE` with the `orderId` returned from `POST /orders`.

```cmd
curl http://localhost:3000/orders/ORDER_ID_HERE
```

Public order lookup returns a safe summary only. Use the admin endpoints below for full customer, address, item, and status-history data.

### POST /auth/login

Replace the email and password with your configured local admin credentials.

```cmd
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@example.com\",\"password\":\"change-this-password\"}"
```

Copy the `accessToken` from the response.

### GET /auth/me

Replace `ACCESS_TOKEN_HERE` with the token returned from `POST /auth/login`.

```cmd
curl http://localhost:3000/auth/me -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### GET /admin/orders

Replace `ACCESS_TOKEN_HERE`. Optional filters include `search`, `orderStatus`, `paymentStatus`, `paymentMethod`, `selectedPackId`, `sourceChannel`, `createdFrom`, `createdTo`, `minTotal`, `maxTotal`, `sortBy`, and `sortOrder`.

```cmd
curl "http://localhost:3000/admin/orders?page=1&pageSize=20&search=0600000000" -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### GET /admin/orders/:id

Replace `ORDER_ID_HERE` and `ACCESS_TOKEN_HERE`.

```cmd
curl http://localhost:3000/admin/orders/ORDER_ID_HERE -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### PATCH /admin/orders/:id/status

Replace `ORDER_ID_HERE` and `ACCESS_TOKEN_HERE`. Valid workflow examples are `CONFIRMED`, `PREPARING`, `SHIPPED`, `DELIVERED`, `RETURNED`, and `CANCELED`, depending on the current order status.

```cmd
curl -X PATCH http://localhost:3000/admin/orders/ORDER_ID_HERE/status -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"status\":\"CONFIRMED\",\"comment\":\"Confirmed by phone\"}"
```

```cmd
curl -X PATCH http://localhost:3000/admin/orders/ORDER_ID_HERE/status -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"status\":\"PREPARING\",\"comment\":\"Preparing package\"}"
```

```cmd
curl -X PATCH http://localhost:3000/admin/orders/ORDER_ID_HERE/status -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"status\":\"SHIPPED\",\"comment\":\"Handed to delivery\"}"
```

```cmd
curl -X PATCH http://localhost:3000/admin/orders/ORDER_ID_HERE/status -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"status\":\"DELIVERED\",\"comment\":\"Delivered and COD collected\"}"
```

For a delivered COD order, `DELIVERED` marks payment as `PAID`. If the order is later returned, use:

```cmd
curl -X PATCH http://localhost:3000/admin/orders/ORDER_ID_HERE/status -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"status\":\"RETURNED\",\"comment\":\"Customer returned the order\"}"
```

### GET /admin/categories

```cmd
curl "http://localhost:3000/admin/categories?page=1&pageSize=20" -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### POST /admin/categories

```cmd
curl -X POST http://localhost:3000/admin/categories -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"code\":\"FOUNDATION_ADMIN\",\"name\":\"Foundation Admin\",\"description\":\"Face foundation products\",\"sortOrder\":1,\"isActive\":true}"
```

Copy the category `id` from the response.

### POST /admin/brands

```cmd
curl -X POST http://localhost:3000/admin/brands -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"name\":\"Admin Demo Beauty\",\"description\":\"Demo brand\",\"isActive\":true}"
```

Copy the brand `id` from the response.

### POST /admin/products

Replace `CATEGORY_ID_HERE` and `BRAND_ID_HERE`.

```cmd
curl -X POST http://localhost:3000/admin/products -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"categoryId\":\"CATEGORY_ID_HERE\",\"brandId\":\"BRAND_ID_HERE\",\"name\":\"Admin Foundation X\",\"slug\":\"admin-foundation-x\",\"description\":\"Demo foundation\",\"basePrice\":120,\"costPrice\":70,\"currency\":\"MAD\",\"status\":\"ACTIVE\",\"isActive\":true}"
```

Copy the product `id` from the response.

### POST /admin/products/:productId/references

Replace `PRODUCT_ID_HERE`.

```cmd
curl -X POST http://localhost:3000/admin/products/PRODUCT_ID_HERE/references -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"referenceCode\":\"RF2\",\"referenceName\":\"Medium Warm\",\"sku\":\"ADMIN-FOUNDATION-X-RF2\",\"priceDelta\":0,\"stockQuantity\":20,\"reservedQuantity\":0,\"lowStockThreshold\":5,\"isDefault\":true,\"isActive\":true,\"attributes\":[{\"attributeGroupCode\":\"SKIN_COLOR\",\"attributeOptionCode\":\"MEDIUM\",\"matchType\":\"COMPATIBLE\",\"scoreValue\":40,\"isHardFilter\":false},{\"attributeGroupCode\":\"UNDERTONE\",\"attributeOptionCode\":\"WARM\",\"matchType\":\"COMPATIBLE\",\"scoreValue\":25,\"isHardFilter\":false}]}"
```

Copy the reference `id` from the response.

### PATCH /admin/product-references/:id/stock

Replace `REFERENCE_ID_HERE`.

```cmd
curl -X PATCH http://localhost:3000/admin/product-references/REFERENCE_ID_HERE/stock -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"stockQuantity\":30,\"reservedQuantity\":2,\"lowStockThreshold\":5}"
```

### GET /admin/products/:id

Replace `PRODUCT_ID_HERE`.

```cmd
curl http://localhost:3000/admin/products/PRODUCT_ID_HERE -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### DELETE /admin/products/:id

Replace `PRODUCT_ID_HERE`. This archives the product and deactivates references.

```cmd
curl -X DELETE http://localhost:3000/admin/products/PRODUCT_ID_HERE -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### GET /admin/packs

```cmd
curl "http://localhost:3000/admin/packs?page=1&pageSize=20" -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### POST /admin/packs

Creates a draft pack. Draft packs may be created before items are attached.

```cmd
curl -X POST http://localhost:3000/admin/packs -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"name\":\"Admin Natural Pack\",\"slug\":\"admin-natural-pack\",\"description\":\"Admin-created pack\",\"priceMode\":\"FIXED\",\"fixedPrice\":249,\"minBudget\":200,\"maxBudget\":350,\"currency\":\"MAD\",\"priority\":10,\"status\":\"DRAFT\",\"isActive\":false}"
```

Copy the pack `id` from the response.

### PATCH /admin/packs/:id

Replace `PACK_ID_HERE`, `FOUNDATION_PRODUCT_ID_HERE`, `MASCARA_PRODUCT_ID_HERE`, and `MASCARA_REFERENCE_ID_HERE`.

```cmd
curl -X PATCH http://localhost:3000/admin/packs/PACK_ID_HERE -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"status\":\"ACTIVE\",\"isActive\":true,\"fixedPrice\":249,\"items\":[{\"productId\":\"FOUNDATION_PRODUCT_ID_HERE\",\"selectionMode\":\"AUTO_BEST_REFERENCE\",\"quantity\":1,\"isRequired\":true,\"sortOrder\":1},{\"productId\":\"MASCARA_PRODUCT_ID_HERE\",\"productReferenceId\":\"MASCARA_REFERENCE_ID_HERE\",\"selectionMode\":\"FIXED_REFERENCE\",\"quantity\":1,\"isRequired\":true,\"sortOrder\":2}],\"attributes\":[{\"attributeGroupCode\":\"STYLE\",\"attributeOptionCode\":\"NATURAL\",\"matchType\":\"COMPATIBLE\",\"scoreValue\":20,\"isHardFilter\":false},{\"attributeGroupCode\":\"BUDGET\",\"attributeOptionCode\":\"MEDIUM\",\"matchType\":\"COMPATIBLE\",\"scoreValue\":10,\"isHardFilter\":false}]}"
```

### GET /admin/packs/:id

Replace `PACK_ID_HERE`.

```cmd
curl http://localhost:3000/admin/packs/PACK_ID_HERE -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### DELETE /admin/packs/:id

Replace `PACK_ID_HERE`. This archives the pack without deleting pack items or attributes.

```cmd
curl -X DELETE http://localhost:3000/admin/packs/PACK_ID_HERE -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### POST /admin/attributes

```cmd
curl -X POST http://localhost:3000/admin/attributes -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"code\":\"COVERAGE\",\"name\":\"Coverage\",\"description\":\"Preferred makeup coverage\",\"isCustomerAttribute\":true,\"isProductAttribute\":true,\"sortOrder\":6,\"isActive\":true}"
```

Copy the attribute group `id`.

### POST /admin/attributes/:attributeGroupId/options

Replace `ATTRIBUTE_GROUP_ID_HERE`.

```cmd
curl -X POST http://localhost:3000/admin/attributes/ATTRIBUTE_GROUP_ID_HERE/options -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"code\":\"FULL\",\"label\":\"Full Coverage\",\"description\":\"Maximum makeup coverage\",\"sortOrder\":3,\"isActive\":true}"
```

Copy option IDs for quiz mappings.

### POST /admin/quiz/questions

Replace `ATTRIBUTE_GROUP_ID_HERE` and `ATTRIBUTE_OPTION_ID_HERE`.

```cmd
curl -X POST http://localhost:3000/admin/quiz/questions -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"attributeGroupId\":\"ATTRIBUTE_GROUP_ID_HERE\",\"questionText\":\"What coverage do you prefer?\",\"helperText\":\"Choose your preferred result\",\"selectionType\":\"SINGLE\",\"isRequired\":true,\"stepOrder\":6,\"isActive\":false,\"options\":[{\"attributeOptionId\":\"ATTRIBUTE_OPTION_ID_HERE\",\"sortOrder\":1,\"isActive\":true}]}"
```

Copy the quiz question `id`.

### PATCH /admin/quiz/questions/:id

Replace `QUIZ_QUESTION_ID_HERE`.

```cmd
curl -X PATCH http://localhost:3000/admin/quiz/questions/QUIZ_QUESTION_ID_HERE -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"isActive\":true}"
```

### POST /admin/recommendation-rules

Replace `ATTRIBUTE_GROUP_ID_HERE`.

```cmd
curl -X POST http://localhost:3000/admin/recommendation-rules -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"code\":\"COVERAGE_MATCH\",\"name\":\"Coverage match\",\"targetType\":\"PACK\",\"attributeGroupId\":\"ATTRIBUTE_GROUP_ID_HERE\",\"conditionType\":\"SHOULD_MATCH\",\"scoreValue\":15,\"weight\":1,\"isActive\":true}"
```

Copy the recommendation rule `id`.

### POST /admin/recommendation-rules/preview

Replace `CUSTOMER_PROFILE_ID_HERE`.

```cmd
curl -X POST http://localhost:3000/admin/recommendation-rules/preview -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"customerProfileId\":\"CUSTOMER_PROFILE_ID_HERE\"}"
```

### DELETE /admin/recommendation-rules/:id

Replace `RECOMMENDATION_RULE_ID_HERE`.

```cmd
curl -X DELETE http://localhost:3000/admin/recommendation-rules/RECOMMENDATION_RULE_ID_HERE -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### POST /admin/media/upload

Replace `C:\path\to\image.jpg` with a local JPEG, PNG, WEBP, or AVIF image path. Cloudinary environment variables must be configured in `.env`; do not commit real credentials.

```cmd
curl -X POST http://localhost:3000/admin/media/upload -H "Authorization: Bearer ACCESS_TOKEN_HERE" -F "file=@C:\path\to\image.jpg" -F "folder=recommended-packs/products" -F "altText=Foundation bottle shade medium warm" -F "usageContext=PRODUCT_MAIN_IMAGE"
```

Copy the media asset `id`.

### GET /admin/media

```cmd
curl "http://localhost:3000/admin/media?page=1&pageSize=20&search=foundation" -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### GET /admin/media/:id

Replace `MEDIA_ASSET_ID_HERE`.

```cmd
curl http://localhost:3000/admin/media/MEDIA_ASSET_ID_HERE -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```

### PATCH /admin/media/:id

Replace `MEDIA_ASSET_ID_HERE`.

```cmd
curl -X PATCH http://localhost:3000/admin/media/MEDIA_ASSET_ID_HERE -H "Authorization: Bearer ACCESS_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"altText\":\"Updated image description\",\"usageContext\":\"PACK_MAIN_IMAGE\"}"
```

### DELETE /admin/media/:id

Replace `MEDIA_ASSET_ID_HERE`. This deletes the Cloudinary image and soft-deletes the local media record.

```cmd
curl -X DELETE http://localhost:3000/admin/media/MEDIA_ASSET_ID_HERE -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```
