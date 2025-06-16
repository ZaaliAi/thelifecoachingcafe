# Testimonial Functionality Testing Strategy

This document outlines the test cases for the newly implemented testimonial functionality, covering API endpoints, frontend components, and the homepage display.

## 1. API Endpoint Tests

These tests should verify the behavior of the testimonial API routes. Tools like `supertest` (for Node.js/Express-like environments) or Next.js specific API route testing utilities (e.g., with `jest` or `vitest` and `node-mocks-http`) would be appropriate.

**Location:** Tests could reside in `src/app/api/testimonials/route.test.ts` and `src/app/api/testimonials/[id]/route.test.ts` or a similar structure if using Next.js API routes. If backend logic is in Firebase Functions, tests might be in `functions/src/index.test.ts` or dedicated test files for the testimonial functions.

### `POST /api/testimonials`

*   **Test Case 1.1.1:** Create a new testimonial with valid data.
    *   **Given:** A request payload with `name` and `text` (and optional `imageUrl`, `designation`).
    *   **When:** A POST request is made to `/api/testimonials`.
    *   **Then:** The API should return a `201 Created` status code.
    *   **And:** The response body should contain the created testimonial, including `id`, `createdAt`, and `updatedAt` fields.
    *   **And:** The testimonial should be saved in the Firestore database.

*   **Test Case 1.1.2:** Attempt to create a testimonial with missing required fields (name).
    *   **Given:** A request payload missing the `name` field.
    *   **When:** A POST request is made to `/api/testimonials`.
    *   **Then:** The API should return a `400 Bad Request` status code.
    *   **And:** The response body should contain an error message indicating the missing field.

*   **Test Case 1.1.3:** Attempt to create a testimonial with missing required fields (text).
    *   **Given:** A request payload missing the `text` field.
    *   **When:** A POST request is made to `/api/testimonials`.
    *   **Then:** The API should return a `400 Bad Request` status code.
    *   **And:** The response body should contain an error message indicating the missing field.

### `GET /api/testimonials`

*   **Test Case 1.2.1:** Fetch all testimonials.
    *   **Given:** Multiple testimonials exist in the database.
    *   **When:** A GET request is made to `/api/testimonials`.
    *   **Then:** The API should return a `200 OK` status code.
    *   **And:** The response body should be an array of testimonial objects.
    *   **And:** Testimonials should ideally be ordered (e.g., by `createdAt` descending).

*   **Test Case 1.2.2:** Fetch testimonials when none exist.
    *   **Given:** No testimonials exist in the database.
    *   **When:** A GET request is made to `/api/testimonials`.
    *   **Then:** The API should return a `200 OK` status code.
    *   **And:** The response body should be an empty array.

### `GET /api/testimonials/[id]` (Endpoint for fetching a single testimonial by ID)

*   **Test Case 1.3.1:** Fetch an existing testimonial by ID.
    *   **Given:** A testimonial with a specific ID exists.
    *   **When:** A GET request is made to `/api/testimonials/{id}` with the existing ID.
    *   **Then:** The API should return a `200 OK` status code.
    *   **And:** The response body should contain the correct testimonial object.

*   **Test Case 1.3.2:** Attempt to fetch a non-existent testimonial by ID.
    *   **Given:** A testimonial ID that does not correspond to any entry in the database.
    *   **When:** A GET request is made to `/api/testimonials/{id}` with the non-existent ID.
    *   **Then:** The API should return a `404 Not Found` status code.

### `PUT /api/testimonials/[id]`

*   **Test Case 1.4.1:** Update an existing testimonial with valid data.
    *   **Given:** An existing testimonial and a request payload with updated `name`, `text`, or other fields.
    *   **When:** A PUT request is made to `/api/testimonials/{id}` with the existing ID and valid data.
    *   **Then:** The API should return a `200 OK` status code.
    *   **And:** The response body should contain the updated testimonial object, including an updated `updatedAt` timestamp.
    *   **And:** The testimonial in the database should reflect the changes.

*   **Test Case 1.4.2:** Attempt to update a testimonial with missing required fields (e.g., empty name).
    *   **Given:** An existing testimonial and a request payload with an empty `name`.
    *   **When:** A PUT request is made to `/api/testimonials/{id}`.
    *   **Then:** The API should return a `400 Bad Request` status code (if validation prevents empty required fields).
    *   **And:** The response body should contain an error message.

*   **Test Case 1.4.3:** Attempt to update a non-existent testimonial.
    *   **Given:** A testimonial ID that does not exist and a valid request payload.
    *   **When:** A PUT request is made to `/api/testimonials/{id}` with the non-existent ID.
    *   **Then:** The API should return a `404 Not Found` status code.

### `DELETE /api/testimonials/[id]`

*   **Test Case 1.5.1:** Delete an existing testimonial.
    *   **Given:** An existing testimonial ID.
    *   **When:** A DELETE request is made to `/api/testimonials/{id}`.
    *   **Then:** The API should return a `200 OK` status code (or `204 No Content`).
    *   **And:** The testimonial should be removed from the database.

*   **Test Case 1.5.2:** Attempt to delete a non-existent testimonial.
    *   **Given:** A testimonial ID that does not exist.
    *   **When:** A DELETE request is made to `/api/testimonials/{id}`.
    *   **Then:** The API should return a `404 Not Found` status code.

## 2. Frontend Component Tests

These tests will use a library like React Testing Library with Jest or Vitest. Mocking of API calls (`fetch` or custom data fetching functions) will be necessary.

### `TestimonialCard.tsx`

**Location:** `src/components/TestimonialCard.test.tsx` (or similar, like `src/components/ui/TestimonialCard.test.tsx` if it's considered a generic UI component)

*   **Test Case 2.1.1:** Render testimonial with all details.
    *   **Given:** A `testimonial` prop with `name`, `text`, `imageUrl`, and `designation`.
    *   **When:** The `TestimonialCard` component is rendered.
    *   **Then:** The component should display the name, text, designation, and image (checking for `src` attribute).

*   **Test Case 2.1.2:** Render testimonial with optional fields missing.
    *   **Given:** A `testimonial` prop with only `name` and `text` (no `imageUrl`, no `designation`).
    *   **When:** The `TestimonialCard` component is rendered.
    *   **Then:** The component should display the name and text.
    *   **And:** It should not render an `<img>` tag if `imageUrl` is missing (or render a placeholder if designed that way).
    *   **And:** It should not render the designation element if `designation` is missing.

### `TestimonialForm.tsx`

**Location:** `src/components/dashboard/TestimonialForm.test.tsx`

*   **Test Case 2.2.1:** Render all form fields.
    *   **Given:** The `TestimonialForm` component is rendered (in create mode, no `initialData`).
    *   **When:** The form is inspected.
    *   **Then:** Input fields for "Name", "Testimonial Text", "Image URL", and "Designation" should be present.
    *   **And:** The submit button should say "Add Testimonial" (or similar).

*   **Test Case 2.2.2:** Display validation errors for required fields.
    *   **Given:** The `TestimonialForm` is rendered.
    *   **When:** The submit button is clicked without filling in "Name" and "Testimonial Text".
    *   **Then:** Validation error messages should be displayed for "Name" and "Testimonial Text".
    *   **And:** The `onSubmit` (mocked API call) function should not have been called.

*   **Test Case 2.2.3:** Submit form with valid data (Create mode).
    *   **Given:** The `TestimonialForm` is rendered.
    *   **When:** "Name" and "Testimonial Text" are filled, and the submit button is clicked.
    *   **Then:** The (mocked) API call function (`fetch` to `POST /api/testimonials`) should be called with the correct form data.

*   **Test Case 2.2.4:** Pre-fill form fields when `initialData` is provided (Edit mode).
    *   **Given:** The `TestimonialForm` is rendered with `initialData` containing a testimonial's details and `testimonialId`.
    *   **When:** The form is inspected.
    *   **Then:** The input fields should be pre-filled with values from `initialData`.
    *   **And:** The submit button should say "Save Changes" (or similar).

*   **Test Case 2.2.5:** Submit form with valid data (Edit mode).
    *   **Given:** The `TestimonialForm` is rendered with `initialData` and `testimonialId`.
    *   **When:** Form fields are (optionally modified and still valid) and the submit button is clicked.
    *   **Then:** The (mocked) API call function (`fetch` to `PUT /api/testimonials/[id]`) should be called with the correct form data and ID.

### `src/app/dashboard/admin/testimonials/page.tsx` (Admin Testimonials Page)

**Location:** `src/app/dashboard/admin/testimonials/page.test.tsx`

*   **Test Case 2.3.1:** Display table of testimonials on successful fetch.
    *   **Given:** The page is rendered and the (mocked) API call to fetch testimonials returns a list of items.
    *   **When:** Data fetching completes.
    *   **Then:** A table should be displayed with rows corresponding to the fetched testimonials.
    *   **And:** Columns for `name`, `text`, `createdAt`, `updatedAt` should be visible.
    *   **And:** "Edit" and "Delete" buttons should be present for each row.

*   **Test Case 2.3.2:** Display loading state.
    *   **Given:** The page is rendered and the API call is in progress.
    *   **When:** Data is being fetched.
    *   **Then:** A loading indicator (e.g., "Loading testimonials...") should be visible.

*   **Test Case 2.3.3:** Display error message on fetch failure.
    *   **Given:** The page is rendered and the (mocked) API call to fetch testimonials fails.
    *   **When:** Data fetching fails.
    *   **Then:** An error message (e.g., "Failed to load testimonials") should be visible.

*   **Test Case 2.3.4:** Display "No testimonials" message.
    *   **Given:** The page is rendered and the (mocked) API call returns an empty list.
    *   **When:** Data fetching completes.
    *   **Then:** A message like "No testimonials found" should be visible.

*   **Test Case 2.3.5:** "Add Testimonial" button navigation.
    *   **Given:** The page is rendered.
    *   **When:** The "Add Testimonial" button is clicked.
    *   **Then:** Navigation to `/dashboard/admin/testimonials/new` should occur (mock `useRouter`).

*   **Test Case 2.3.6:** "Edit" button navigation.
    *   **Given:** The page is rendered with at least one testimonial.
    *   **When:** The "Edit" button for a specific testimonial is clicked.
    *   **Then:** Navigation to `/dashboard/admin/testimonials/edit/[id]` (with the correct ID) should occur.

*   **Test Case 2.3.7:** "Delete" button shows confirmation and calls API.
    *   **Given:** The page is rendered with at least one testimonial.
    *   **When:** The "Delete" button for a testimonial is clicked.
    *   **Then:** A confirmation dialog should appear.
    *   **When:** The delete action is confirmed in the dialog.
    *   **Then:** The (mocked) API call to `DELETE /api/testimonials/[id]` should be made with the correct ID.
    *   **And:** The testimonial row should be removed from the table (optimistic update or re-fetch).

## 3. Homepage Test

**Location:** `src/app/page.test.tsx`

*   **Test Case 3.1.1:** Fetch and display testimonials.
    *   **Given:** The `HomePage` component is rendered.
    *   **When:** The (mocked) `getTestimonials` function successfully returns a list of testimonials.
    *   **Then:** The testimonials section should display `TestimonialCard` components for each fetched testimonial.

*   **Test Case 3.1.2:** Display fallback if no testimonials are fetched.
    *   **Given:** The `HomePage` component is rendered.
    *   **When:** The (mocked) `getTestimonials` function returns an empty array or throws an error.
    *   **Then:** The testimonials section should display a fallback message (e.g., "No testimonials yet. Check back soon!").

This comprehensive list should provide good coverage for the testimonial functionality.
