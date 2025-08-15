# CoreFans, a OnlyFans-style SocialFi platform

**URL**: https://corefans.xyz(very soon)

CoreFans, a OnlyFans-style SocialFi platform where each user has a personalized token or Access Pass NFT associated with their account. These tokens can be traded, and Access Pass NFTs grant access to content creators, that can include both real individuals and virtual AI avatars (like VTubers), managed by teams.

## Key Features

- Personalized Tokens/Access Pass NFTs: Each user (content creator or fan) has their own tradable token or Access Pass NFT that can be bought, sold, or transferred.
- Access to Content: Access Pass NFTs can be used to unlock access to exclusive content, such as virtual meetups, livestreams, or private content from creators (including both real and virtual AI avatars).
- Virtual AI Creators: Integrate AI-driven virtual avatars (similar to VTubers) that are managed and operated by content creation teams.
- Access Pass NFT Trading: Allow users to trade or sell Access Pass NFTs to each other, creating a secondary market around content access.
- Fan Engagement: Fans can interact with virtual or real content creators in personalized ways based on their Access Pass NFT ownership.

## Architecture & Directory Structure

### Core Application Structure

The platform follows a modern full-stack architecture with clear separation of concerns. The frontend utilizes a component-based framework where the main layout consists of a three-column design: navigation sidebar, main content area, and promotional sidebar. This layout pattern ensures consistent user experience while maintaining flexibility for different content types.

The navigation system demonstrates a hierarchical approach to feature organization. The sidebar navigation component manages state for active sections, notification counters, and user context. Each navigation item corresponds to a specific route and feature set, with the platform supporting both traditional page-based routing and real-time content streams.

### User Profile Management System

The user profile architecture reveals sophisticated data modeling requirements. Each user profile contains multiple content type counters that update in real-time as users create content. The profile system tracks posts, images, videos, audio files, and live streams as separate entities, suggesting a flexible content management system that can handle diverse media types.

The profile biographical information includes structured data fields for location, external links, join dates, and custom descriptions. This indicates a robust user schema that balances required fields with optional customization options. The profile system also manages online status indicators, suggesting real-time presence tracking functionality.

### Content Management and Organization

The platform's content system demonstrates advanced categorization and interaction capabilities. Posts support rich media embedding, polling functionality, and engagement metrics tracking. The polling system specifically shows percentage-based voting with real-time updates, requiring backend calculations that maintain accuracy across concurrent user interactions.

The engagement system tracks multiple interaction types including likes, comments, and tips. The tips feature indicates integration with payment processing systems, suggesting the platform supports creator monetization through direct user-to-user financial transactions. This requires secure payment handling and financial record keeping.

### Real-time Features Implementation

The live streaming functionality represents a significant technical requirement. The prominent "GO LIVE" button and streams counter in user profiles indicate that real-time video broadcasting is a core platform feature. This suggests implementation of WebRTC or similar streaming protocols, along with content delivery network integration for scalable video distribution.

The notification system displays sophisticated state management with different notification types tracked separately. Messages show a count of ten unread items, while streams indicate one active item. This granular notification tracking requires a flexible event system that can categorize and aggregate different types of user interactions.

## Database Schema Considerations

### User and Profile Tables

The user profile system requires tables that efficiently store and retrieve user information along with content statistics. The profile displays comprehensive metrics including total posts, media counts by type, and engagement statistics. This suggests denormalized data storage for performance, with background processes maintaining count accuracy.

The online status tracking and recent activity indicators require timestamp fields and potentially Redis-based session management for real-time presence detection. The join date display indicates standard datetime handling with proper timezone consideration for global user bases.

### Content and Interaction Models

The polling functionality reveals complex data relationships where each poll contains multiple options with real-time vote tracking. This requires normalized poll structures with separate tables for poll options and user votes, along with efficient aggregation queries for percentage calculations.

The engagement system with likes, comments, and tips requires flexible interaction tables that can handle different interaction types while maintaining referential integrity. The tip functionality specifically requires integration with financial transaction records and user wallet or payment method management.

## Frontend Component Architecture

### Navigation and Layout Components

The sidebar navigation demonstrates component composition where each navigation item manages its own state while participating in global navigation context. The notification badges require real-time updates, suggesting WebSocket or Server-Sent Events integration for pushing count updates to connected clients.

The layout system accommodates both static content display and dynamic real-time features. The main content area adapts to different content types while maintaining consistent interaction patterns across posts, polls, and media content.

### Content Display and Interaction

The post component system handles diverse content types including text, polls, and media attachments. The polling interface specifically requires client-side state management for vote submission and real-time result updates. This suggests a reactive component architecture that can handle optimistic updates while maintaining data consistency.

The engagement buttons for likes, comments, and tips require careful state management to prevent duplicate interactions while providing immediate user feedback. The tip functionality particularly needs integration with payment processing workflows and success/failure state handling.

## API Design and Backend Services

### RESTful Endpoints and Real-time Integration

The platform requires comprehensive API design covering user management, content creation, interaction tracking, and real-time features. Standard CRUD operations handle basic content management, while specialized endpoints manage complex features like poll creation and voting, live stream initiation, and financial transactions.

The real-time features require WebSocket connections or similar persistent connection protocols. The live streaming functionality needs specialized endpoints for stream initialization, viewer management, and stream termination. The notification system requires event broadcasting capabilities to push updates to connected clients.

### Authentication and Authorization

The user profile system with personalized content and financial features requires robust authentication and authorization. The platform needs to handle user sessions, permission management for different content types, and secure access to financial features like tipping functionality.