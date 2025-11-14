# Dynamic List Component

The Dynamic List component is a powerful and flexible feature for Fliplet apps that allows you to display dynamic data from a Fliplet Data Source in a variety of list-based layouts. It is designed to be highly configurable and extensible for developers.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Setup and Configuration](#setup-and-configuration)
- [Developer Guide](#developer-guide)
  - [File Structure](#file-structure)
  - [Customization with Hooks](#customization-with-hooks)
  - [Advanced Templating](#advanced-templating)
- [Included Layouts](#included-layouts)

---

## Features

- **Data Source Integration:** Seamlessly connects to any Fliplet Data Source to display records.
- **Multiple Layouts:** Comes with several pre-built layouts to suit different use cases, such as agendas, news feeds, and card-based lists.
- **Filtering and Searching:** Provides robust options for both client-side and server-side filtering and searching to help users find information quickly.
- **Interactive Detail Views:** Users can click on a list item to open a detailed overlay view with more information.
- **CRUD Operations:** Supports adding, editing, and deleting data source entries directly from the list (when configured with appropriate link actions and user permissions).
- **Highly Customizable:** Offers advanced settings for developers to override HTML templates and extend functionality using JavaScript hooks.
- **Permission-Aware:** Respects data source security rules, showing or hiding actions like "add," "edit," and "delete" based on the current user's permissions.

## Requirements

- A Fliplet account and a Fliplet app.
- A Fliplet Data Source populated with the data you wish to display.

## Setup and Configuration

1.  **Add Component:** Drag and drop the Dynamic List component onto a screen in your Fliplet app.
2.  **Select Data Source:** In the component's configuration panel, choose the Data Source you want to pull data from.
3.  **Choose a Layout:** Select one of the available layouts (e.g., "Simple List," "Small Horizontal Cards").
4.  **Configure Summary View:** Map columns from your Data Source to the fields in the list's summary view (e.g., title, subtitle, thumbnail).
5.  **Configure Detail View:** Set up the detail view that appears when a user clicks an item. You can configure which fields to show and add interactive buttons (e.g., "Email," "Call").
6.  **Set Up Actions:**
    *   **On item click:** Define what happens when a user clicks a list item (e.g., show detail screen, run a link action).
    *   **Add/Edit/Delete:** Link to form screens to allow users to add or edit entries. Enable the delete option and configure its behavior.
7.  **Configure Filters and Search:** Enable and configure the fields that users can filter or search by.

## Developer Guide

This component is built to be extended and customized by developers.

### File Structure

The component's source code is organized as follows:

-   `css/`: Contains the stylesheets for all layouts.
-   `js/`: Contains the core JavaScript logic.
    -   `interface.js`: The main public interface for the component, responsible for initializing the correct layout.
    -   `build.js`: Core logic for fetching data and building the list structure.
    -   `build-lists.js`: Handles rendering the list items.
    -   `utils.js`: A collection of shared utility functions for record management, user permissions, navigation, and more.
    -   `layout-javascript/`: Contains the layout-specific JavaScript logic. Each file corresponds to a layout and handles its unique rendering and event listeners.
-   `templates/`: Contains the Handlebars.js templates for the base HTML, list item loops, and detail views for each layout.

### Customization with Hooks

You can inject custom logic at various points in the component's lifecycle using Fliplet Hooks. To use a hook, add custom JavaScript to your screen or app that looks like this:

```javascript
Fliplet.Hooks.on('flListDataAfterGetData', function (data) {
  // data.records contains the array of records from the data source
  // You can modify the records here before they are rendered.
  console.log('Data has been loaded:', data.records);

  // IMPORTANT: Always return a promise or the original data
  return Promise.resolve();
});
```

**Available Hooks:**

-   `flListDataBeforeGetData(options)`: Runs before data is fetched from the data source.
-   `flListDataAfterGetData(data)`: Runs after data has been fetched but before it is rendered. A great place to manipulate the data.
-   `flListDataBeforeRenderList(data)`: Runs just before the list items are rendered to the DOM.
-   `flListDataAfterRenderList(data)`: Runs after the list has been rendered. Useful for attaching third-party plugins.
-   `flListDataBeforeDeleteConfirmation(options)`: Runs before the "Are you sure?" delete confirmation is shown.
-   `flListDataBeforeDeleteEntry(options)`: Runs after the user confirms deletion but before the entry is removed from the data source.

### Advanced Templating

For ultimate control over the markup, you can provide your own Handlebars.js templates in the component's advanced settings. You can override the templates for:

-   **Base HTML:** The main container for the list.
-   **Loop HTML:** The template for a single list item.
-   **Detail HTML:** The template for the detail view overlay.

When writing custom templates, you have access to the data passed by the component. Use the existing templates in the `/templates` directory as a starting point.

## Included Layouts

This component includes the following layouts out of the box:

-   **Agenda:** A layout optimized for displaying events or appointments, typically grouped by date.
-   **News Feed:** A classic feed-style layout for articles or updates.
-   **Simple List:** A basic, clean list format.
-   **Small Card:** A compact card-based layout.
-   **Small Horizontal Card:** A card-based layout with a horizontal orientation, ideal for showing a thumbnail next to text content.
