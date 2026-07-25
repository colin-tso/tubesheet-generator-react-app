import GitHubButton from "react-github-btn";

export function FormFooter() {
    return (
        <div className="form-footer">
            <footer>
                <GitHubButton
                    href="https://github.com/colin-tso/tubesheet-generator-react-app"
                    data-color-scheme="light"
                    data-size="large"
                    aria-label=" View this repo on GitHub"
                >
                    View this repo on GitHub
                </GitHubButton>
                <br />
                Released under a GPL 3.0 license.{" "}
                <a
                    href="https://www.gnu.org/licenses/gpl-3.0.en.html"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <br />
                    Find out more here.
                </a>
            </footer>
        </div>
    );
}
