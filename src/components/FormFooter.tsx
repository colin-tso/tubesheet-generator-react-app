import GithubIcon from "@/assets/github-icon.svg?react";
import LicenseIcon from "@/assets/license-icon.svg?react";

export function FormFooter() {
    return (
        <div className="form-footer">
            <footer>
                <a
                    className="footer-link-btn"
                    href="https://github.com/colin-tso/tubesheet-generator-react-app"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <GithubIcon className="footer-link-btn-icon" aria-hidden="true" />
                    View on GitHub
                </a>
                <a
                    className="footer-link-btn"
                    href="https://www.gnu.org/licenses/gpl-3.0.en.html"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <LicenseIcon className="footer-link-btn-icon" aria-hidden="true" />
                    GPL-3.0
                </a>
            </footer>
        </div>
    );
}
