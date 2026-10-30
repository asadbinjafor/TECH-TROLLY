"use client";
import {
  cloneElement,
  useId,
  type AriaAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

type ControlProps = {
  id?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
};

/** Paired labels align; each control keeps its own descriptions and actions. */
export function FormField({
  label,
  optional = false,
  optionalText = "Optional",
  hint,
  error,
  action,
  wide = false,
  className = "",
  children,
  hintRole,
}: {
  label: ReactNode;
  optional?: boolean;
  optionalText?: string;
  hint?: ReactNode;
  error?: ReactNode;
  action?: ReactNode;
  hintRole?: "status";
  wide?: boolean;
  className?: string;
  children: ReactElement<ControlProps>;
}) {
  const generated = useId();
  const id = children.props.id || `field-${generated}`;
  // Older translations included optional text inside the label itself.
  const fieldLabel =
    optional && typeof label === "string"
      ? label.replace(/\s*·\s*(?:optional|ঐচ্ছিক)(\s*%)?/gi, (_, percent) =>
          percent ? " (%)" : "",
        )
      : label;
  const describedBy =
    [
      children.props["aria-describedby"],
      hint ? `${id}-hint` : "",
      error ? `${id}-error` : "",
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div
      className={`form-field${wide ? " wide" : ""}${error ? " has-error" : ""}${className ? " " + className : ""}`}
    >
      <label className="field-label" htmlFor={id}>
        {fieldLabel}
        {optional && (
          <>
            {" "}
            <span className="field-optional">({optionalText})</span>
          </>
        )}
      </label>
      <div className="field-body">
        <div className="field-control">
          {cloneElement(children, {
            id,
            className: ["form-control", children.props.className]
              .filter(Boolean)
              .join(" "),
            "aria-describedby": describedBy,
            "aria-invalid": error ? true : children.props["aria-invalid"],
          })}
        </div>
        <div className="field-details">
          {hint && (
            <div id={`${id}-hint`} className="field-hint" role={hintRole}>
              {hint}
            </div>
          )}
          {error && (
            <div id={`${id}-error`} className="field-error" role="alert">
              {error}
            </div>
          )}
          {action && <div className="field-actions">{action}</div>}
        </div>
      </div>
    </div>
  );
}

export function FormGrid({
  children,
  single = false,
  className = "",
  disabled,
  as = "div",
}: {
  children: ReactNode;
  single?: boolean;
  className?: string;
  disabled?: boolean;
  as?: "div" | "fieldset";
}) {
  const classes = `form-grid${single ? " form-grid--single" : ""}${className ? " " + className : ""}`;
  return (
    <div className="form-layout">
      {as === "fieldset" ? (
        <fieldset className={classes} disabled={disabled}>
          {children}
        </fieldset>
      ) : (
        <div className={classes}>{children}</div>
      )}
    </div>
  );
}
