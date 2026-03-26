import * as React from "react";

export function ListRow(props: {
  indentPx?: number;
  left: React.ReactNode;
  actionsLeft?: React.ReactNode;
  actionsRight: React.ReactNode;
}) {
  const indentPx = props.indentPx ?? 0;
  return (
    <div className="ps-row" style={{ marginLeft: indentPx }}>
      <div className="ps-rowLeft">
        <div className="ps-rowMain">{props.left}</div>
      </div>
      <div className="ps-rowActions">
        {props.actionsLeft ? <span style={{ marginRight: "0.25rem" }}>{props.actionsLeft}</span> : null}
        {props.actionsRight}
      </div>
    </div>
  );
}

