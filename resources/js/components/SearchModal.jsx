import debounce from 'lodash.debounce';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SuggestRow from './SuggestRow';

const SearchModal = ({ isOpen, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [scopes, setScopes] = useState([]);
    const [fileSuggestions, setFileSuggestions] = useState([]);
    const [scopeSuggestions, setScopeSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const suggestionsRef = useRef([]);
    const inputRef = useRef();

    useEffect(() => {
        const scopes = [];
        const select = document.getElementById('searchscope');
        if (select) {
            const slug = select?.children?.[1]?.value;
            if (slug) {
                const packageName = decodeURIComponent(slug).split('/').slice(2, 4).join('/');
                scopes.push({ type: 'manual', title: packageName });
            }
        }
        const url = new URL(window.location.href);
        url.searchParams?.forEach((value, key) => {
            if (key === 'q') {
                setSearchQuery(value);
            } else if (key === 'scope') {
                const packageName = decodeURIComponent(value).split('/').slice(2, 4).join('/');
                scopes.push({ type: 'manual', title: packageName });
            } else if (key.startsWith('filters[')) {
                const filterExp = new RegExp(/filters\[(.*?)\]\[(.*?)\]/);
                const [, type, filterValue] = key.match(filterExp);
                if (type === 'optionsaggs') {
                    scopes.push({ type: 'option', title: filterValue });
                } else {
                    scopes.push({ type, title: filterValue });
                }
            }
        });

        setScopes(scopes);
    }, []);

    const buildHref = (scopes, query) => {
        const url = new URL('/search/search', 'https://docs.typo3.org');
        scopes.forEach(scope => {
            if (scope.type === 'manual' || scope.type === 'vendor') {
                /* TODO: API currently don't return the slug for packages, so we can't build the URL entirely */
                url.searchParams.append(`scope`, encodeURIComponent(`/${scope.slug}/`));
            } else if (scope.type === 'option') {
                url.searchParams.append(`filters[optionaggs][${scope.title}]`, true);
            } else {
                url.searchParams.append(`filters[${scope.type}][${scope.title}]`, true);
            }
        });
        url.searchParams.append('q', query);
        return url.href;
    };

    const decomposedScopes = useMemo(() => {
        const decomposed = [];
        for (let i = scopes.length;i > 0;i--) {
            const currentScopes = scopes.slice(-i);
            if (currentScopes.length === 1 && currentScopes[0].type === 'manual') {
                decomposed.push({ scopes: currentScopes, title: searchQuery, tooltip: 'Search in this manual', href: buildHref(currentScopes, searchQuery) });
                const vendorScope = [{ type: 'vendor', title: currentScopes[0].title.split('/')[0] }];
                decomposed.push({ scopes: vendorScope, title: searchQuery, tooltip: 'Search in this vendor', href: buildHref(vendorScope, searchQuery) });
            } else {
                decomposed.push({ scopes: currentScopes, title: searchQuery, tooltip: 'Search in this scope', href: buildHref(currentScopes, searchQuery) });
            }
        };
        if (searchQuery) decomposed.push({ scopes: [], title: searchQuery, tooltip: 'Search all', href: buildHref([], searchQuery) });
        return decomposed;
    }, [scopes, searchQuery]);

    const handleScopeSelect = (title, type) => {
        const newScopes = [...scopes];
        const existingScopeIndex = newScopes.findIndex(scope => scope.type === type);
        if (existingScopeIndex !== -1) {
            newScopes[existingScopeIndex] = { type, title };
        } else {
            newScopes.push({ type, title });
        }

        setScopes(newScopes);
        setSearchQuery('');
        setActiveIndex(-1);
        inputRef.current.focus();
    };

    useEffect(() => {
        fetchSuggestions(scopes, searchQuery);
    }, [scopes]);

    const buildRequestUrl = (scopes, searchQuery) => {
        const url = new URL('https://docs.typo3.org/search/suggest');
        scopes.forEach(scope => {
            if (scope.type === 'manual') {
                url.searchParams.append(`filters[package]`, scope.title);
            } else if (scope.type === 'vendor') {
                url.searchParams.append(`filters[${scope.type}]`, scope.title);
            } else if (scope.type === 'option') {
                url.searchParams.append(`filters[optionsaggs][${scope.title}]`, true);
            } else {
                url.searchParams.append(`filters[${scope.type}][${scope.title}]`, true);
            }
        });
        url.searchParams.append('q', searchQuery);
        return url.href;
    };

    const fetchSuggestions = useCallback(async (scopes, searchQuery) => {
        if (scopes?.length === 0 && !searchQuery) {
            setFileSuggestions([]);
            setScopeSuggestions([]);
            return;
        }
        setIsLoading(true);
        const requestUrl = buildRequestUrl(scopes, searchQuery);
        await fetch(requestUrl, {
            headers: {
                'Content-Type': 'application/json',
            },
        }).then(response => {
            if (!response.ok) {
                throw new Error('Network response error');
            }
            return response.json();
        }).then(data => {
            applyData(data);
        }).catch(e => {
            console.error(e);
            setFileSuggestions([]);
            setScopeSuggestions([]);
        }).finally(() => {
            setIsLoading(false);
        });
    }, []);

    const debounceFetchSuggestions = useCallback(debounce(fetchSuggestions, 300), []);

    const applyData = (data) => {
        const fileSuggestions = data?.results?.map(result => ({
            title: result.snippet_title,
            packageName: result.manual_package,
            href: `https://docs.typo3.org/${result.manual_slug}/${result.relative_url}#${result.fragment}`,
        }));
        const scopeSuggestions = Object.entries(data?.suggest?.suggestions ?? {}).flatMap(([scope, suggestions]) => {
            const type = scope.replace('manual_', '') === 'package' ? 'manual' : scope.replace('manual_', '');
            return suggestions.map(suggestion => ({
                type,
                title: type === 'version' ? suggestion.split('.')[0] : suggestion
            })
            );
        });
        setScopeSuggestions(scopeSuggestions);
        setFileSuggestions(fileSuggestions);
    };

    const handleSearchChange = (e) => {
        const newQuery = e.target.value;
        setSearchQuery(newQuery);
        if (newQuery !== '') {
            debounceFetchSuggestions(scopes, newQuery);
        }
    };

    const handleKeyDown = (e) => {
        const totalItems = [...decomposedScopes, ...scopeSuggestions, ...fileSuggestions].length;

        switch (e.key) {
            case 'Backspace':
                if (inputRef.current.selectionStart === 0) {
                    setScopes(prevScopes => {
                        prevScopes.pop();
                        return [...prevScopes];
                    });
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(prev => (prev < totalItems - 1 ? prev + 1 : -1));
                break;

            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(prev => (prev > -1 ? prev - 1 : totalItems - 1));
                break;

            case 'Enter':
                e.preventDefault();
                if (activeIndex >= 0) {
                    suggestionsRef.current[activeIndex]?.click();
                } else {
                    window.location.href = buildHref(scopes, searchQuery);
                }
                break;
        }
    };

    useEffect(() => {
        if (activeIndex >= 0) {
            suggestionsRef.current[activeIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        }
    }, [activeIndex]);

    useEffect(() => {
    }, [fileSuggestions]);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="search-modal">
            <div className="search-modal__overlay" onClick={onClose}></div>
            <div className="search-modal__content">
                <div className="search-modal__header">
                    <div className="search-modal__input-wrapper"
                        onClick={() => {
                            setActiveIndex(-1);
                        }}>
                        <i className="fa fa-search search-modal__icon"></i>
                        {scopes.map((scope, index) => (
                            <span key={`scope-${index}`} className="search-modal__scope">
                                {scope.type}:<p className="search-modal__scope-title">{scope.title}</p>
                            </span>
                        ))}
                        <input
                            ref={inputRef}
                            autoComplete='off'
                            name='q'
                            autoFocus
                            type="text"
                            className="search-modal__input"
                            placeholder={scopes?.length > 0 ? 'search in this scope...' : 'Search documentation...'}
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onKeyDown={handleKeyDown}
                        />
                        {(searchQuery || scopes.length > 0) && (
                            <button
                                className="search-modal__clear"
                                onClick={() => {
                                    setSearchQuery('');
                                    setScopes([]);
                                    setActiveIndex(-1);
                                    inputRef.current.focus();
                                }}
                            >
                                <i className="fa fa-circle-xmark"></i>
                            </button>
                        )}
                    </div>
                </div>

                <ul className="search-modal__body">
                    {decomposedScopes?.length > 0 && <li className="search-modal__section">
                        <div className="search-modal__items" role="group" aria-label="Decomposed scopes">
                            {decomposedScopes.map((item, index) => (
                                <SuggestRow
                                    key={`decomposed-${index}`}
                                    scopes={item.scopes}
                                    title={item.title}
                                    tooltip={item.tooltip}
                                    isActive={activeIndex === index}
                                    ref={el => suggestionsRef.current[index] = el}
                                    href={item.href}
                                />
                            ))}
                        </div>
                    </li>}
                    {isLoading ? (
                        <div className="search-modal__loading">
                            <div className="search-modal__spinner">
                                <i className="fa fa-spinner fa-spin"></i>
                            </div>
                            <p>Searching...</p>
                        </div>
                    ) : (<>
                        {decomposedScopes?.length > 0 && scopeSuggestions?.length > 0 && <li className="search-modal__divider"></li>}
                        {scopeSuggestions?.length > 0 && <li className="search-modal__section">
                            <div className="search-modal__items" role="group" aria-label="Scope suggestions">
                                {scopeSuggestions.map(({ title, type }, index) => (
                                    <SuggestRow
                                        key={`scope-${index}`}
                                        title={title}
                                        type={type}
                                        isActive={activeIndex === (index + decomposedScopes.length)}
                                        ref={el => suggestionsRef.current[index + decomposedScopes.length] = el}
                                        tooltip="Filter for this"
                                        onClick={() => handleScopeSelect(title, type)}
                                    />
                                ))}
                            </div>
                        </li>}
                        {decomposedScopes?.length > 0 && fileSuggestions?.length > 0 && <li className="search-modal__divider"></li>}
                        {fileSuggestions?.length > 0 && <li className="search-modal__section">
                            <div className="search-modal__items" role="group" aria-label="File suggestions">
                                {fileSuggestions.map(({ title, packageName, href }, index) => (
                                    <SuggestRow
                                        key={`file-${index}`}
                                        title={title}
                                        packageName={packageName}
                                        isActive={activeIndex === (index + decomposedScopes.length + scopeSuggestions.length)}
                                        href={href}
                                        ref={el => suggestionsRef.current[index + decomposedScopes.length + scopeSuggestions.length] = el}
                                        tooltip="Open this page"
                                        icon="file"
                                    />
                                ))}
                            </div>
                        </li>}
                    </>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default SearchModal;