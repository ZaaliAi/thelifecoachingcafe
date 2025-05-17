# **App Name**: CoachConnect

This document outlines the steps to create a Cloud Firestore database for user profiles and blog data, assuming no prior knowledge of Firestore. It will cover setting up Firestore in a Firebase project, structuring data for user profiles and blog posts, and basic security rules.

## Core Features:

## Setting up Firebase and Firestore

1.  **Create a Firebase Project:**
    *   Go to the Firebase console: [https://console.firebase.google.com/](https://console.firebase.google.com/)
    *   Click on "Add project".
    *   Give your project a name (e.g., "CoachConnect").
    *   Follow the steps to create your project. You may be asked about Google Analytics; for this project, you can choose whether to enable it or not, as it's not essential for setting up Firestore.

2.  **Add Firestore to your Project:**
    *   Once your project is created, you'll be taken to the project overview page.
    *   In the left-hand navigation menu, find the "Build" section and click on "Firestore Database".
    *   Click on "Create database".
    *   You will be prompted to choose a mode:
        *   **Native mode:** This is the recommended mode for most use cases. It offers strong consistency and real-time updates. This is the mode we will use for CoachConnect.
        *   **Datastore mode:** This mode is designed for large-scale applications and offers eventual consistency. It's more suitable for applications that require high availability and scalability over strong consistency.
    *   Select "Native mode" and click "Next".
    *   Choose a location for your database. Select the location that is closest to your users for better performance.
    *   Click "Enable".

    Firebase will now set up your Firestore database. This may take a few moments. Once it's ready, you'll be taken to the Firestore data viewer.

## Data Structuring

We will structure the data for user profiles and blog posts within Firestore. This involves defining collections and the fields within the documents in those collections.

## Security Rules

We will define security rules to control access to our Firestore data, ensuring that only authorized users can read and write specific data.

- Directory & Search: Landing page with coach directory, search, and featured coaches.
- CoachMatch AI: AI tool to provide a list of ranked coaches, based on matching keywords and specialties in coach profiles to user needs. This feature will involve usage of the model's reasoning when suggesting possible coaches.
- Coach Registration: Allow coaches to register with bios and specialties to create searchable profile pages.
- Blog Section: Allow coaches to write and submit blog posts.
- Admin Moderation: Admins must approve coach registration and blog submission.

## Basic Security Rules

Firestore Security Rules control access to your database. They are essential for protecting your data and ensuring that users can only read and write the data they are authorized to access. Rules are defined in the Firebase console under the "Firestore Database" section, in the "Rules" tab.

Here's a basic example of security rules for your `users` and `blogs` collections:



## Style Guidelines:

- Primary color: Soft lavender (#D0BFFF) to promote a sense of calm and well-being, relating to the supportive nature of life coaching.
- Background color: Light, desaturated lavender (#F4F2FF) to maintain a clean and calming aesthetic.
- Accent color: Muted blue (#A0CFEC) to add a touch of trust and professionalism, analogous to lavender but distinct enough to highlight key interactive elements.
- Clean and readable typography to ensure content is easily accessible.
- Simple, professional icons for easy navigation.
- Subtle transitions for a smooth user experience.