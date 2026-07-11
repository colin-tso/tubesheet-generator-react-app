declare module "*.svg" {
    const ReactComponent: React.FunctionComponent<React.SVGAttributes<SVGElement>>;
    export { ReactComponent };
}

/// <reference types="react-scripts" />
declare module "*.css" {
    const classes: { [key: string]: string };
    export default classes;
}
