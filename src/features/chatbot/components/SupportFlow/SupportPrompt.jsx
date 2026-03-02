import React from "react";

const SupportPrompt = ({ onYes, onNo, isSubmitting }) => (
    <div className="supportForm">
        <p>Would you like to contact our support team?</p>
        <div className="button-group">
            <button type="submit" onClick={onYes} disabled={isSubmitting}>Yes</button>
            <button className="cancelBtn" onClick={onNo} disabled={isSubmitting}>No</button>
        </div>
    </div>
);

export default SupportPrompt;
