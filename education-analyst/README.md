# Education Analyst Agent

This is a specialized AI Agent designed to act as a **Senior Education Industry Data Analyst**.
It runs entirely in your browser using a custom System Prompt and connects to an OpenAI-compatible API (like GPT-4, DeepSeek, etc.) to process your requests.

## Features

- **Specialized Persona**: Strictly follows a 7-step analysis workflow tailored for EdTech/Adult Education.
- **Structured Output**: Generates clean, formatted reports including Business Context, Key Data facts, Hypotheses, Risks, and actionable Advice.
- **Private & Secure**: API Keys and settings are stored locally in your browser (`localStorage`) and never sent to any third-party server besides the API endpoint you configure.
- **Responsive UI**: Professional dashboard design that works on Desktop and Mobile.

## Usage

1.  **Open the Application**:
    Double-click `index.html` to open it in your web browser.

2.  **Configure API**:
    - Select your **AI Provider** (OpenAI, DeepSeek, or Google Gemini).
        - The Base URL and Model Name will automatically update.
    - Enter your **API Key** (e.g., `sk-...`).
    - (Optional) Change the **Base URL** if you are using a proxy or a custom provider.
    - (Optional) Change the **Model Name**.
    - Click **保存设置 (Save Settings)**.

3.  **Start Analyzing**:
    - **Upload Data**: Click the paperclip icon (📎) to attach CSV, Excel, PDF, Word, or Text files.
    - **Describe Context**: In the main input box, describe your business situation or ask questions about the uploaded data.
    - Example: _"Recently, our adult coding course has seen a drop in conversion from free trial to paid users. Traffic is steady, but ROI is dropping."_
    - The Agent will reply with a rigorous analysis following the required educational industry framework.

## Project Structure

- `index.html`: Main application file.
- `style.css`: Styling and layout.
- `script.js`: Application logic and the **System Prompt**.

## License

Personal Use.
