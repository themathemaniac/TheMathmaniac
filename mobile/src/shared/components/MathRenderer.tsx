import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { WebView } from 'react-native-webview';

interface MathRendererProps {
  text: string;
  isDarkText?: boolean;
  style?: any;
}

export const hasMathExpressions = (text: string): boolean => {
  if (!text) return false;
  return text.includes('\\') || text.includes('$') || text.includes('$$');
};

export const MathRenderer: React.FC<MathRendererProps> = ({
  text,
  isDarkText = true,
  style,
}) => {
  const [webViewHeight, setWebViewHeight] = useState(40);

  // Helper to wrap LaTeX expressions in delimiters if they don't have them
  const preprocessText = (input: string) => {
    if (!input) return '';
    // If it already has delimiters, return it
    if (input.includes('$') || input.includes('\\(') || input.includes('\\[') || input.includes('$$')) {
      return input;
    }
    // Match any sequence starting with a backslash and containing math characters
    // E.g. \int_{0}^{2} 3x^2 dx
    const latexRegex = /(\\[a-zA-Z]+[a-zA-Z0-9\s\+\-\*\/\=\(\)\^\_\{\}\\]*)/g;
    return input.replace(latexRegex, '$$$1$$');
  };

  const formattedText = preprocessText(text);

  // HTML content with KaTeX support from CDN
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
      <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 16px;
          line-height: 1.5;
          color: ${isDarkText ? '#15100A' : '#F8FAFC'};
          background-color: transparent;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        #content {
          padding: 2px 0;
          word-wrap: break-word;
        }
        .katex-display {
          margin: 0.5em 0;
        }
      </style>
    </head>
    <body>
      <div id="content"></div>
      <script>
        const rawText = ${JSON.stringify(formattedText)};
        document.getElementById("content").innerText = rawText;
        
        try {
          renderMathInElement(document.getElementById("content"), {
            delimiters: [
              {left: "$$", right: "$$", display: true},
              {left: "$", right: "$", display: false},
              {left: "\\(", right: "\\)", display: false},
              {left: "\\[", right: "\\]", display: true}
            ],
            throwOnError: false
          });
        } catch (e) {
          console.error(e);
        }

        function updateHeight() {
          var height = document.documentElement.scrollHeight || document.body.scrollHeight;
          window.ReactNativeWebView.postMessage(JSON.stringify({ height: height }));
        }

        window.onload = function() {
          updateHeight();
          setTimeout(updateHeight, 100);
          setTimeout(updateHeight, 500);
        };
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[{ height: webViewHeight, overflow: 'hidden' }, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={{ backgroundColor: 'transparent' }}
        scrollEnabled={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.height) {
              setWebViewHeight(data.height + 4);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }}
      />
    </View>
  );
};
