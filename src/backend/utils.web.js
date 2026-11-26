import { Permissions, webMethod } from "wix-web-module";
import wixData from 'wix-data';

export const getAllCities = webMethod(
    Permissions.Anyone,
    async () => {
        let response = await wixData.query("Properties").descending("_createdDate").distinct("stateCity");
        if (response.items) {
            const uniqueCities = [...new Set(response.items.map(city => city.trim().toLowerCase()))]
                .map(city => city.charAt(0).toUpperCase() + city.slice(1));

            let dropdownOptions = uniqueCities.map((item) => {
                return {
                    label: item,
                    value: item
                }
            })

            return dropdownOptions;
        }
        return {};
    }
);

export const getAllCitiesByCountry = webMethod(
    Permissions.Anyone,
    async (country) => {
        let response = await wixData.query("Properties").descending("_createdDate").eq("country", country).limit(999).find({suppressAuth: true});
        if (response.items) {
          let allCities = response.items.map(item => item.stateCity);
            const uniqueCities = [...new Set(allCities.map(city => city.trim().toLowerCase()))]
                .map(city => city.charAt(0).toUpperCase() + city.slice(1));

            let dropdownOptions = uniqueCities.map((item) => {
                return {
                    label: item,
                    value: item
                }
            })

            return dropdownOptions;
        }
        return {};
    }
);