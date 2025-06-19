
import Script from 'next/script';

interface SchemaProps {
  data: Record<string, any>;
}

const SchemaMarkup: React.FC<SchemaProps> = ({ data }) => {
  return (
    <Script
      id={`schema-${Math.random()}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
    />
  );
};

export default SchemaMarkup;
