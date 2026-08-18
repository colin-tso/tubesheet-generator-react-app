import GithubIcon from "@/assets/github-icon.svg?react";
import { loadDocsPage } from "@/docs/loadDocsPage";

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
                    View this repo on GitHub
                </a>
                <br />
                {/* Warms the docs chunk (katex/mdx/diagrams) before the click,
                    so Root.tsx's pre-transition await resolves instantly. */}
                <a
                    className="github-button"
                    href="#/docs"
                    onMouseEnter={loadDocsPage}
                    onFocus={loadDocsPage}
                >
                    How the layout math works
                </a>
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
