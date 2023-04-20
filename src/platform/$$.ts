function $$(selector: string, root: HTMLElement = document.body): HTMLElement[] {
    return Array.from(root.querySelectorAll(selector));
}
export default $$;