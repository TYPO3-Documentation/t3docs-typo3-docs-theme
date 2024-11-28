import { useState, useEffect } from 'react';

export const useSearchScopes = () => {
    const [scopes, setScopes] = useState([]);

    useEffect(() => {
        const initialScopes = [];
        const select = document.getElementById('searchscope');

        // Handle select element scope
        if (select?.children?.[1]?.value) {
            const slug = select.children[1].value;
            const packageName = decodeURIComponent(slug).split('/').slice(2, 4).join('/');
            initialScopes.push({ type: 'manual', title: packageName });
        }

        // Handle URL params
        const url = new URL(window.location.href);
        url.searchParams?.forEach((value, key) => {
            if (key === 'scope') {
                const packageName = decodeURIComponent(value).split('/').slice(2, 4).join('/');
                initialScopes.push({ type: 'manual', title: packageName });
            } else if (key.startsWith('filters[')) {
                const filterExp = new RegExp(/filters\[(.*?)\]\[(.*?)\]/);
                const [, type, filterValue] = key.match(filterExp);
                initialScopes.push({ 
                    type: type === 'optionsaggs' ? 'option' : type, 
                    title: filterValue 
                });
            }
        });

        setScopes(initialScopes);
    }, []);

    return [scopes, setScopes];
}; 