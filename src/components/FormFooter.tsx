import GithubIcon from "@/assets/github-icon.svg?react";
import LicenseIcon from "@/assets/license-icon.svg?react";

export function FormFooter() {
    return (
        <div className="form-footer">
            <footer>
                <a
                    className="github-button"
                    href="https://github.com/colin-tso/tubesheet-generator-react-app"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <GithubIcon className="github-button-icon" aria-hidden="true" />
                    View on GitHub
                </a>
                <a
                    className="license-button"
                    href="https://www.gnu.org/licenses/gpl-3.0.en.html"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <LicenseIcon className="license-button-icon" aria-hidden="true" />
                    GPL-3.0
                </a>
            </footer>
        </div>
    );
}
