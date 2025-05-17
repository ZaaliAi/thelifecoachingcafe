
import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  // Adjustments for the longer name "The Life Coaching Cafe"
  const text = "The Life Coaching Cafe";
  const fontSize = 18; // Reduced font size
  const textLength = text.length * (fontSize * 0.5); // Approximate text length
  const svgWidth = Math.max(280, textLength + 20); // Dynamic width
  const svgHeight = 50;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`} // Adjusted viewBox
      width={svgWidth * 0.75} // Adjusted display width
      height={svgHeight * 0.75} // Adjusted display height
      aria-label="The Life Coaching Cafe Logo"
      {...props}
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: 'hsl(var(--accent))', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600&display=swap');
          .logo-text { font-family: 'Poppins', sans-serif; fill: url(#logoGradient); }
        `}
      </style>
      <text x="10" y="35" className="logo-text" fontSize={fontSize} fontWeight="600">
        {text}
      </text>
    </svg>
  );
}
