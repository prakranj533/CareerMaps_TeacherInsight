export const LinkedText = ({ text }: { text?: string }) => (
  <>
    {(text || "—").split(/((?:https?:\/\/|www\.)[^\s<>"，,]+)/gi).map((part, index) => {
      if (!/^(?:https?:\/\/|www\.)/i.test(part)) return part;
      const url = part.replace(/[.;!?)\]]+$/, "");
      return (
        <span key={index}>
          <a
            href={/^www\./i.test(url) ? `https://${url}` : url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {url}
          </a>
          {part.slice(url.length)}
        </span>
      );
    })}
  </>
);
