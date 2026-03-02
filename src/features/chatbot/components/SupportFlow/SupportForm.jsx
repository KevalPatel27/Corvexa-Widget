import React from "react";

const SupportForm = ({ formData, onFormChange, onSubmit, onCancel, isSubmitting }) => (
    <div className="Defaultmsg">
        <form className="supportForm" onSubmit={onSubmit}>
            <h3>Support Form</h3>
            <input
                type="text"
                placeholder="Your Name"
                value={formData.name}
                onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
                required
            />
            <input
                type="email"
                placeholder="Your Email"
                value={formData.email}
                onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
                pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                required
            />
            <textarea
                placeholder="Describe your issue..."
                value={formData.user_issue}
                onChange={(e) => onFormChange({ ...formData, user_issue: e.target.value })}
                required
            />
            <div className="button-group">
                <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit"}
                </button>
                <button type="button" className="cancelBtn" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    </div>
);

export default SupportForm;
